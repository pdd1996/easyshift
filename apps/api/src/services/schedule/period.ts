import type { PeriodEditStatus } from '@easyshift/shared-types';
import { isMonday } from '@easyshift/shared-types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { schedulePeriods } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';

export interface PeriodDto {
  id: number;
  weekStart: string;
  editStatus: PeriodEditStatus;
  hasUnpublishedChanges: boolean;
  latestPublishedVersion: number | null;
  lastPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListPeriodsQuery {
  fromWeekStart?: string;
  toWeekStart?: string;
}

function toPeriodDto(row: typeof schedulePeriods.$inferSelect): PeriodDto {
  return {
    id: row.id,
    weekStart: row.weekStart,
    editStatus: row.editStatus,
    hasUnpublishedChanges: row.hasUnpublishedChanges,
    latestPublishedVersion: row.latestPublishedVersion,
    lastPublishedAt: row.lastPublishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

export async function getPeriodRow(departmentId: number, periodId: number) {
  const [row] = await db
    .select()
    .from(schedulePeriods)
    .where(and(eq(schedulePeriods.id, periodId), eq(schedulePeriods.departmentId, departmentId)))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', '排班周期不存在');
  }

  return row;
}

export async function listPeriods(
  departmentId: number,
  query: ListPeriodsQuery = {},
): Promise<PeriodDto[]> {
  const conditions = [eq(schedulePeriods.departmentId, departmentId)];

  if (query.fromWeekStart) {
    conditions.push(gte(schedulePeriods.weekStart, query.fromWeekStart));
  }
  if (query.toWeekStart) {
    conditions.push(lte(schedulePeriods.weekStart, query.toWeekStart));
  }

  const rows = await db
    .select()
    .from(schedulePeriods)
    .where(and(...conditions))
    .orderBy(asc(schedulePeriods.weekStart));

  return rows.map(toPeriodDto);
}

export async function getPeriod(departmentId: number, periodId: number): Promise<PeriodDto> {
  const row = await getPeriodRow(departmentId, periodId);
  return toPeriodDto(row);
}

export async function createPeriod(
  departmentId: number,
  weekStart: string,
): Promise<{ period: PeriodDto; created: boolean }> {
  if (!isMonday(weekStart)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'weekStart 必须为周一', { weekStart });
  }

  const [existing] = await db
    .select()
    .from(schedulePeriods)
    .where(and(eq(schedulePeriods.departmentId, departmentId), eq(schedulePeriods.weekStart, weekStart)))
    .limit(1);

  if (existing) {
    return { period: toPeriodDto(existing), created: false };
  }

  try {
    const [result] = await db.insert(schedulePeriods).values({
      departmentId,
      weekStart,
      editStatus: 'draft',
      hasUnpublishedChanges: false,
    });

    const row = await getPeriodRow(departmentId, Number(result.insertId));
    return { period: toPeriodDto(row), created: true };
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      const [row] = await db
        .select()
        .from(schedulePeriods)
        .where(
          and(eq(schedulePeriods.departmentId, departmentId), eq(schedulePeriods.weekStart, weekStart)),
        )
        .limit(1);

      if (row) {
        return { period: toPeriodDto(row), created: false };
      }
    }

    throw error;
  }
}
