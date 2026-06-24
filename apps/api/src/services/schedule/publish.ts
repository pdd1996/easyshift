import type { DailyCoverageItemDto, ScheduleEntryDto } from '@easyshift/shared-types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  departments,
  employees,
  scheduleChangeLogs,
  scheduleEntries,
  schedulePeriods,
  schedulePublishSnapshots,
  shiftTypes,
} from '../../db/schema/index.js';
import { nowShanghaiDatetime } from '../../lib/datetime.js';
import { AppError } from '../../lib/errors.js';
import { buildCoverageWarnings, computeDailyCoverage } from './coverage.js';
import { buildNotificationText } from './notification-text.js';

export interface PublishResult {
  version: number;
  publishedAt: string;
  notificationText: string;
}

export interface PublishOptions {
  acknowledgeWarnings?: boolean;
}

interface SnapshotShiftType {
  id: number;
  code: string;
  name: string;
  startTime: string | null;
  durationMinutes: number | null;
  color: string;
  minRequiredCount: number;
}

interface SnapshotEmployee {
  id: number;
  employeeNo: string;
  name: string;
  title: string | null;
}

interface SnapshotData {
  meta: {
    departmentId: number;
    departmentName: string;
    weekStart: string;
    version: number;
    publishedAt: string;
  };
  shiftTypes: SnapshotShiftType[];
  employees: SnapshotEmployee[];
  entries: ScheduleEntryDto[];
  dailyCoverage: DailyCoverageItemDto[];
}

function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'errno' in error) &&
    ((error as { code?: unknown }).code === 'ER_DUP_ENTRY' ||
      (error as { errno?: unknown }).errno === 1062)
  );
}

function toEntryDto(row: typeof scheduleEntries.$inferSelect): ScheduleEntryDto {
  return {
    employeeId: row.employeeId,
    workDate: row.workDate,
    shiftTypeId: row.shiftTypeId,
    note: row.note,
  };
}

async function buildSnapshotData(
  tx: Pick<typeof db, 'select'>,
  departmentId: number,
  departmentName: string,
  period: typeof schedulePeriods.$inferSelect,
  version: number,
  publishedAt: string,
): Promise<SnapshotData> {
  const entryRows = await tx
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.periodId, period.id))
    .orderBy(asc(scheduleEntries.workDate), asc(scheduleEntries.employeeId));

  const entries = entryRows.map(toEntryDto);
  const entryEmployeeIds = [...new Set(entryRows.map((row) => row.employeeId))];
  const entryShiftTypeIds = [...new Set(entryRows.map((row) => row.shiftTypeId))];

  const activeEmployeeRows = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.departmentId, departmentId), eq(employees.status, 'active')))
    .orderBy(asc(employees.employeeNo), asc(employees.id));

  let inactiveWithEntries: typeof employees.$inferSelect[] = [];
  if (entryEmployeeIds.length > 0) {
    inactiveWithEntries = await tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.departmentId, departmentId),
          eq(employees.status, 'inactive'),
          inArray(employees.id, entryEmployeeIds),
        ),
      )
      .orderBy(asc(employees.employeeNo), asc(employees.id));
  }

  const employeeMap = new Map<number, SnapshotEmployee>();
  for (const row of [...activeEmployeeRows, ...inactiveWithEntries]) {
    employeeMap.set(row.id, {
      id: row.id,
      employeeNo: row.employeeNo,
      name: row.name,
      title: row.title,
    });
  }

  const snapshotEmployees = [...employeeMap.values()].sort((a, b) =>
    a.employeeNo.localeCompare(b.employeeNo, 'zh-CN'),
  );

  const shiftTypeRows = await tx
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.departmentId, departmentId))
    .orderBy(asc(shiftTypes.sortOrder), asc(shiftTypes.id));

  const snapshotShiftTypes = shiftTypeRows
    .filter(
      (row) => row.status === 'active' || entryShiftTypeIds.includes(row.id),
    )
    .map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      startTime: row.startTime,
      durationMinutes: row.durationMinutes,
      color: row.color,
      minRequiredCount: row.minRequiredCount,
    }));

  const activeShiftTypesForCoverage = snapshotShiftTypes.filter((shiftType) =>
    shiftTypeRows.find((row) => row.id === shiftType.id && row.status === 'active'),
  );

  const dailyCoverage = computeDailyCoverage(
    period.weekStart,
    activeShiftTypesForCoverage.map((shiftType) => ({
      ...shiftType,
      status: 'active' as const,
      sortOrder: 0,
    })),
    entries,
  );

  return {
    meta: {
      departmentId,
      departmentName,
      weekStart: period.weekStart,
      version,
      publishedAt,
    },
    shiftTypes: snapshotShiftTypes,
    employees: snapshotEmployees,
    entries,
    dailyCoverage,
  };
}

export async function publishPeriod(
  departmentId: number,
  periodId: number,
  operatorId: number,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const [department] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  if (!department) {
    throw new AppError(500, 'INTERNAL_ERROR', '科室数据未初始化');
  }

  try {
    return await db.transaction(async (tx) => {
      const [period] = await tx
        .select()
        .from(schedulePeriods)
        .where(and(eq(schedulePeriods.id, periodId), eq(schedulePeriods.departmentId, departmentId)))
        .for('update')
        .limit(1);

      if (!period) {
        throw new AppError(404, 'NOT_FOUND', '排班周期不存在');
      }

      if (period.editStatus === 'published' && !period.hasUnpublishedChanges) {
        throw new AppError(422, 'NOTHING_TO_PUBLISH', '当前无未发布变更');
      }

      const nextVersion = (period.latestPublishedVersion ?? 0) + 1;
      const { mysql: publishedAtMysql, iso: publishedAtIso } = nowShanghaiDatetime();

      const snapshotData = await buildSnapshotData(
        tx,
        departmentId,
        department.name,
        period,
        nextVersion,
        publishedAtIso,
      );
      const warnings = buildCoverageWarnings(snapshotData.dailyCoverage);
      if (warnings.length > 0 && !options.acknowledgeWarnings) {
        throw new AppError(422, 'UNACKNOWLEDGED_WARNINGS', '存在覆盖不足警告，请确认后继续发布', {
          warnings,
        });
      }

      await tx.insert(schedulePublishSnapshots).values({
        periodId,
        version: nextVersion,
        snapshotData,
        publishedAt: publishedAtMysql,
        publishedBy: operatorId,
      });

      await tx
        .update(schedulePeriods)
        .set({
          editStatus: 'published',
          hasUnpublishedChanges: false,
          latestPublishedVersion: nextVersion,
          lastPublishedAt: publishedAtMysql,
          lastPublishedBy: operatorId,
        })
        .where(eq(schedulePeriods.id, periodId));

      await tx.insert(scheduleChangeLogs).values({
        periodId,
        operatorId,
        action: 'publish',
        detail: { version: nextVersion },
      });

      const notificationText = buildNotificationText(
        department.name,
        period.weekStart,
        nextVersion,
        publishedAtIso,
      );

      return {
        version: nextVersion,
        publishedAt: publishedAtIso,
        notificationText,
      };
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw new AppError(409, 'PUBLISH_CONFLICT', '发布冲突，请稍后重试');
    }
    throw error;
  }
}
