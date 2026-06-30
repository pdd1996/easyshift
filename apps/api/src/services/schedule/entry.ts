import type { ScheduleEntryDto } from '@easyshift/shared-types';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  employees,
  scheduleChangeLogs,
  scheduleEntries,
  schedulePeriods,
  shiftTypes,
} from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { isDateInWeek } from './date-utils.js';
import { getPeriodRow, lockPeriodRow } from './period.js';

export interface EntryInput {
  employeeId: number;
  workDate: string;
  shiftTypeId: number;
  note?: string | null;
}

function toEntryDto(row: typeof scheduleEntries.$inferSelect): ScheduleEntryDto {
  return {
    employeeId: row.employeeId,
    workDate: row.workDate,
    shiftTypeId: row.shiftTypeId,
    note: row.note,
  };
}

function assertNoDuplicateCells(entries: EntryInput[]) {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.employeeId}:${entry.workDate}`;
    if (seen.has(key)) {
      throw new AppError(409, 'SCHEDULE_ENTRY_CONFLICT', '同员工同天不能排多个班次', {
        employeeId: entry.employeeId,
        workDate: entry.workDate,
      });
    }
    seen.add(key);
  }
}

async function validateEntryInput(
  departmentId: number,
  period: typeof schedulePeriods.$inferSelect,
  input: EntryInput,
) {
  if (!Number.isInteger(input.shiftTypeId) || input.shiftTypeId <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'shiftTypeId 无效', {
      shiftTypeId: input.shiftTypeId,
    });
  }

  if (!isDateInWeek(input.workDate, period.weekStart)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'workDate 不在当前排班周内', {
      workDate: input.workDate,
      weekStart: period.weekStart,
    });
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.departmentId, departmentId)))
    .limit(1);

  if (!employee) {
    throw new AppError(404, 'NOT_FOUND', '员工不存在', { employeeId: input.employeeId });
  }

  const [shiftType] = await db
    .select()
    .from(shiftTypes)
    .where(and(eq(shiftTypes.id, input.shiftTypeId), eq(shiftTypes.departmentId, departmentId)))
    .limit(1);

  if (!shiftType) {
    throw new AppError(400, 'VALIDATION_ERROR', '班次类型不存在', {
      shiftTypeId: input.shiftTypeId,
    });
  }

  const [existingEntry] = await db
    .select()
    .from(scheduleEntries)
    .where(
      and(
        eq(scheduleEntries.periodId, period.id),
        eq(scheduleEntries.employeeId, input.employeeId),
        eq(scheduleEntries.workDate, input.workDate),
      ),
    )
    .limit(1);

  if (employee.status === 'inactive' && !existingEntry) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', '停用员工不可新排班', {
      employeeId: input.employeeId,
    });
  }

  if (shiftType.status === 'inactive' && (!existingEntry || existingEntry.shiftTypeId !== input.shiftTypeId)) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', '停用班次不可新排班', {
      shiftTypeId: input.shiftTypeId,
    });
  }
}

export async function upsertEntries(
  departmentId: number,
  periodId: number,
  entries: EntryInput[],
  operatorId: number,
): Promise<ScheduleEntryDto[]> {
  if (entries.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'entries 不能为空');
  }

  assertNoDuplicateCells(entries);

  const period = await getPeriodRow(departmentId, periodId);

  for (const entry of entries) {
    await validateEntryInput(departmentId, period, entry);
  }

  const savedEntries = await db.transaction(async (tx) => {
    const lockedPeriod = await lockPeriodRow(tx, departmentId, periodId);
    const needsPeriodUpdate =
      lockedPeriod.editStatus === 'published' || lockedPeriod.latestPublishedVersion !== null;

    const results: ScheduleEntryDto[] = [];

    for (const entry of entries) {
      const [existing] = await tx
        .select()
        .from(scheduleEntries)
        .where(
          and(
            eq(scheduleEntries.periodId, periodId),
            eq(scheduleEntries.employeeId, entry.employeeId),
            eq(scheduleEntries.workDate, entry.workDate),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(scheduleEntries)
          .set({
            shiftTypeId: entry.shiftTypeId,
            note: entry.note ?? null,
          })
          .where(eq(scheduleEntries.id, existing.id));

        results.push({
          employeeId: entry.employeeId,
          workDate: entry.workDate,
          shiftTypeId: entry.shiftTypeId,
          note: entry.note ?? null,
        });
      } else {
        const [insertResult] = await tx.insert(scheduleEntries).values({
          periodId,
          employeeId: entry.employeeId,
          workDate: entry.workDate,
          shiftTypeId: entry.shiftTypeId,
          note: entry.note ?? null,
        });

        const [row] = await tx
          .select()
          .from(scheduleEntries)
          .where(eq(scheduleEntries.id, Number(insertResult.insertId)))
          .limit(1);

        if (row) {
          results.push(toEntryDto(row));
        }
      }
    }

    if (needsPeriodUpdate) {
      await tx
        .update(schedulePeriods)
        .set({ hasUnpublishedChanges: true })
        .where(eq(schedulePeriods.id, periodId));
    }

    await tx.insert(scheduleChangeLogs).values({
      periodId,
      operatorId,
      action: 'entry_upsert',
      detail: { entries },
    });

    return results;
  });

  return savedEntries;
}

export async function deleteEntry(
  departmentId: number,
  periodId: number,
  employeeId: number,
  workDate: string,
  operatorId: number,
): Promise<boolean> {
  const period = await getPeriodRow(departmentId, periodId);

  if (!isDateInWeek(workDate, period.weekStart)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'workDate 不在当前排班周内', {
      workDate,
      weekStart: period.weekStart,
    });
  }

  const [existing] = await db
    .select()
    .from(scheduleEntries)
    .where(
      and(
        eq(scheduleEntries.periodId, periodId),
        eq(scheduleEntries.employeeId, employeeId),
        eq(scheduleEntries.workDate, workDate),
      ),
    )
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.transaction(async (tx) => {
    const lockedPeriod = await lockPeriodRow(tx, departmentId, periodId);
    const needsPeriodUpdate =
      lockedPeriod.editStatus === 'published' || lockedPeriod.latestPublishedVersion !== null;

    await tx.delete(scheduleEntries).where(eq(scheduleEntries.id, existing.id));

    if (needsPeriodUpdate) {
      await tx
        .update(schedulePeriods)
        .set({ hasUnpublishedChanges: true })
        .where(eq(schedulePeriods.id, periodId));
    }

    await tx.insert(scheduleChangeLogs).values({
      periodId,
      operatorId,
      action: 'entry_delete',
      detail: { employeeId, workDate },
    });
  });

  return true;
}
