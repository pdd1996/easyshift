import type { ScheduleEntryDto } from '@easyshift/shared-types';
import { isMonday } from '@easyshift/shared-types';
import dayjs from 'dayjs';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  employees,
  scheduleChangeLogs,
  scheduleEntries,
  schedulePeriods,
  shiftTypes,
} from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { addDays, isDateInWeek } from './date-utils.js';
import { getPeriodRow, lockPeriodRow } from './period.js';

export interface CopyWarning {
  code:
    | 'SKIPPED_INACTIVE_EMPLOYEE'
    | 'SKIPPED_INACTIVE_SHIFT'
    | 'SKIPPED_MISSING_EMPLOYEE'
    | 'SKIPPED_MISSING_SHIFT';
  message: string;
  employeeId?: number;
  shiftTypeId?: number;
  workDate?: string;
}

export interface CopyFromPreviousWeekOptions {
  sourceWeekStart?: string;
}

export interface CopyFromPreviousWeekResult {
  sourceWeekStart: string;
  copiedCount: number;
  skippedCount: number;
  entries: ScheduleEntryDto[];
  warnings: CopyWarning[];
}

export function mapSourceDateToTarget(
  sourceWorkDate: string,
  sourceWeekStart: string,
  targetWeekStart: string,
): string {
  const offsetDays = dayjs(targetWeekStart).diff(dayjs(sourceWeekStart), 'day');
  return addDays(sourceWorkDate, offsetDays);
}

function resolveSourceWeekStart(
  targetWeekStart: string,
  sourceWeekStart?: string,
): string {
  return sourceWeekStart ?? addDays(targetWeekStart, -7);
}

export async function copyFromPreviousWeek(
  departmentId: number,
  targetPeriodId: number,
  operatorId: number,
  options: CopyFromPreviousWeekOptions = {},
): Promise<CopyFromPreviousWeekResult> {
  const targetPeriod = await getPeriodRow(departmentId, targetPeriodId);
  const sourceWeekStart = resolveSourceWeekStart(targetPeriod.weekStart, options.sourceWeekStart);

  if (!isMonday(sourceWeekStart)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sourceWeekStart 必须为周一', {
      sourceWeekStart,
    });
  }

  if (!dayjs(sourceWeekStart).isBefore(dayjs(targetPeriod.weekStart))) {
    throw new AppError(400, 'VALIDATION_ERROR', '源周须早于目标周', {
      sourceWeekStart,
      targetWeekStart: targetPeriod.weekStart,
    });
  }

  const [sourcePeriod] = await db
    .select()
    .from(schedulePeriods)
    .where(
      and(
        eq(schedulePeriods.departmentId, departmentId),
        eq(schedulePeriods.weekStart, sourceWeekStart),
      ),
    )
    .limit(1);

  if (!sourcePeriod) {
    throw new AppError(404, 'NOT_FOUND', '源周排班周期不存在', { sourceWeekStart });
  }

  const sourceEntryRows = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.periodId, sourcePeriod.id))
    .orderBy(asc(scheduleEntries.workDate), asc(scheduleEntries.employeeId));

  const employeeRows = await db
    .select()
    .from(employees)
    .where(eq(employees.departmentId, departmentId));

  const shiftTypeRows = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.departmentId, departmentId));

  const employeeById = new Map(employeeRows.map((row) => [row.id, row]));
  const shiftTypeById = new Map(shiftTypeRows.map((row) => [row.id, row]));

  const warnings: CopyWarning[] = [];
  const entriesToInsert: ScheduleEntryDto[] = [];

  for (const sourceEntry of sourceEntryRows) {
    const targetWorkDate = mapSourceDateToTarget(
      sourceEntry.workDate,
      sourceWeekStart,
      targetPeriod.weekStart,
    );

    if (!isDateInWeek(targetWorkDate, targetPeriod.weekStart)) {
      continue;
    }

    const employee = employeeById.get(sourceEntry.employeeId);
    if (!employee) {
      warnings.push({
        code: 'SKIPPED_MISSING_EMPLOYEE',
        message: `员工不存在，已跳过 ${sourceEntry.workDate} 的排班`,
        employeeId: sourceEntry.employeeId,
        workDate: sourceEntry.workDate,
      });
      continue;
    }

    if (employee.status === 'inactive') {
      warnings.push({
        code: 'SKIPPED_INACTIVE_EMPLOYEE',
        message: `停用员工 ${employee.name} 不可新排班，已跳过 ${sourceEntry.workDate}`,
        employeeId: employee.id,
        workDate: sourceEntry.workDate,
      });
      continue;
    }

    const shiftType = shiftTypeById.get(sourceEntry.shiftTypeId);
    if (!shiftType) {
      warnings.push({
        code: 'SKIPPED_MISSING_SHIFT',
        message: `班次不存在，已跳过 ${sourceEntry.workDate} 的排班`,
        shiftTypeId: sourceEntry.shiftTypeId,
        workDate: sourceEntry.workDate,
      });
      continue;
    }

    if (shiftType.status === 'inactive') {
      warnings.push({
        code: 'SKIPPED_INACTIVE_SHIFT',
        message: `停用班次 ${shiftType.name} 不可新排班，已跳过 ${sourceEntry.workDate}`,
        shiftTypeId: shiftType.id,
        workDate: sourceEntry.workDate,
      });
      continue;
    }

    entriesToInsert.push({
      employeeId: sourceEntry.employeeId,
      workDate: targetWorkDate,
      shiftTypeId: sourceEntry.shiftTypeId,
      note: sourceEntry.note,
    });
  }

  const savedEntries = await db.transaction(async (tx) => {
    const lockedTargetPeriod = await lockPeriodRow(tx, departmentId, targetPeriodId);
    const needsPeriodUpdate =
      lockedTargetPeriod.editStatus === 'published' ||
      lockedTargetPeriod.latestPublishedVersion !== null;

    await tx.delete(scheduleEntries).where(eq(scheduleEntries.periodId, targetPeriodId));

    if (entriesToInsert.length > 0) {
      await tx.insert(scheduleEntries).values(
        entriesToInsert.map((entry) => ({
          periodId: targetPeriodId,
          employeeId: entry.employeeId,
          workDate: entry.workDate,
          shiftTypeId: entry.shiftTypeId,
          note: entry.note,
        })),
      );
    }

    if (needsPeriodUpdate) {
      await tx
        .update(schedulePeriods)
        .set({ hasUnpublishedChanges: true })
        .where(eq(schedulePeriods.id, targetPeriodId));
    }

    await tx.insert(scheduleChangeLogs).values({
      periodId: targetPeriodId,
      operatorId,
      action: 'copy_from_week',
      detail: {
        sourceWeekStart,
        sourcePeriodId: sourcePeriod.id,
        copiedCount: entriesToInsert.length,
        skippedCount: warnings.length,
      },
    });

    return entriesToInsert;
  });

  return {
    sourceWeekStart,
    copiedCount: savedEntries.length,
    skippedCount: warnings.length,
    entries: savedEntries,
    warnings,
  };
}
