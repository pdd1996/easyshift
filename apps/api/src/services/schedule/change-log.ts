import type { ScheduleChangeLogAction, ScheduleChangeLogDto } from '@easyshift/shared-types';
import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { scheduleChangeLogs, schedulePeriods, users } from '../../db/schema/index.js';
import { mysqlDatetimeToIso } from '../../lib/datetime.js';
import { getPeriodRow } from './period.js';

export const CHANGE_LOG_ACTIONS: ScheduleChangeLogAction[] = [
  'period_create',
  'entry_upsert',
  'entry_delete',
  'copy_from_week',
  'publish',
];

export interface ListChangeLogsQuery {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  periodId?: number;
  weekStart?: string;
  action?: ScheduleChangeLogAction;
  operatorId?: number;
}

interface ChangeLogRow {
  id: number;
  periodId: number;
  weekStart: string;
  action: string;
  operatorId: number;
  operatorPhone: string | null;
  detail: unknown;
  createdAt: string;
}

function toChangeLogDto(row: ChangeLogRow): ScheduleChangeLogDto {
  return {
    id: row.id,
    periodId: row.periodId,
    weekStart: row.weekStart,
    action: row.action as ScheduleChangeLogAction,
    operator: {
      id: row.operatorId,
      phone: row.operatorPhone,
    },
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    createdAt: mysqlDatetimeToIso(row.createdAt),
  };
}

function buildWhereClause(departmentId: number, query: Omit<ListChangeLogsQuery, 'page' | 'pageSize'>) {
  const conditions = [eq(schedulePeriods.departmentId, departmentId)];

  if (query.from) {
    conditions.push(gte(scheduleChangeLogs.createdAt, `${query.from} 00:00:00`));
  }
  if (query.to) {
    conditions.push(lte(scheduleChangeLogs.createdAt, `${query.to} 23:59:59`));
  }
  if (query.periodId) {
    conditions.push(eq(scheduleChangeLogs.periodId, query.periodId));
  } else if (query.weekStart) {
    conditions.push(eq(schedulePeriods.weekStart, query.weekStart));
  }
  if (query.action) {
    conditions.push(eq(scheduleChangeLogs.action, query.action));
  }
  if (query.operatorId) {
    conditions.push(eq(scheduleChangeLogs.operatorId, query.operatorId));
  }

  return and(...conditions);
}

export async function listChangeLogs(departmentId: number, query: ListChangeLogsQuery) {
  if (query.periodId) {
    await getPeriodRow(departmentId, query.periodId);
  }

  const whereClause = buildWhereClause(departmentId, query);
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db
    .select({ total: count() })
    .from(scheduleChangeLogs)
    .innerJoin(schedulePeriods, eq(scheduleChangeLogs.periodId, schedulePeriods.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: scheduleChangeLogs.id,
      periodId: scheduleChangeLogs.periodId,
      weekStart: schedulePeriods.weekStart,
      action: scheduleChangeLogs.action,
      operatorId: scheduleChangeLogs.operatorId,
      operatorPhone: users.phone,
      detail: scheduleChangeLogs.detail,
      createdAt: scheduleChangeLogs.createdAt,
    })
    .from(scheduleChangeLogs)
    .innerJoin(schedulePeriods, eq(scheduleChangeLogs.periodId, schedulePeriods.id))
    .innerJoin(users, eq(scheduleChangeLogs.operatorId, users.id))
    .where(whereClause)
    .orderBy(desc(scheduleChangeLogs.createdAt), desc(scheduleChangeLogs.id))
    .limit(query.pageSize)
    .offset(offset);

  return {
    data: rows.map(toChangeLogDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: totalRow?.total ?? 0,
    },
  };
}

export async function getChangeLogFilterOptions(departmentId: number) {
  const operatorIdRows = await db
    .selectDistinct({ operatorId: scheduleChangeLogs.operatorId })
    .from(scheduleChangeLogs)
    .innerJoin(schedulePeriods, eq(scheduleChangeLogs.periodId, schedulePeriods.id))
    .where(eq(schedulePeriods.departmentId, departmentId));

  const operatorIds = operatorIdRows.map((row) => row.operatorId);
  const operators =
    operatorIds.length === 0
      ? []
      : await db
          .select({ id: users.id, phone: users.phone })
          .from(users)
          .where(inArray(users.id, operatorIds))
          .orderBy(desc(users.id));

  const periods = await db
    .select({
      id: schedulePeriods.id,
      weekStart: schedulePeriods.weekStart,
    })
    .from(scheduleChangeLogs)
    .innerJoin(schedulePeriods, eq(scheduleChangeLogs.periodId, schedulePeriods.id))
    .where(eq(schedulePeriods.departmentId, departmentId))
    .groupBy(schedulePeriods.id, schedulePeriods.weekStart)
    .orderBy(desc(schedulePeriods.weekStart));

  return {
    operators,
    periods,
    actions: CHANGE_LOG_ACTIONS,
  };
}
