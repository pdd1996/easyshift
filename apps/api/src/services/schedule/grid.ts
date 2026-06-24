import type { EmployeeDto, ScheduleEntryDto, ScheduleGridDto } from '@easyshift/shared-types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { employees, scheduleEntries } from '../../db/schema/index.js';
import { listShiftTypes } from '../shift-type.js';
import { computeDailyCoverage } from './coverage.js';
import { buildScheduleWarnings } from './warnings.js';
import { getPeriodRow } from './period.js';

function toEmployeeDto(row: typeof employees.$inferSelect): EmployeeDto {
  return {
    id: row.id,
    employeeNo: row.employeeNo,
    name: row.name,
    title: row.title,
    phone: row.phone,
    status: row.status,
  };
}

function toEntryDto(row: typeof scheduleEntries.$inferSelect): ScheduleEntryDto {
  return {
    employeeId: row.employeeId,
    workDate: row.workDate,
    shiftTypeId: row.shiftTypeId,
    note: row.note,
  };
}

export async function getScheduleGrid(
  departmentId: number,
  periodId: number,
): Promise<ScheduleGridDto> {
  const periodRow = await getPeriodRow(departmentId, periodId);

  const entryRows = await db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.periodId, periodId))
    .orderBy(asc(scheduleEntries.workDate), asc(scheduleEntries.employeeId));

  const entries = entryRows.map(toEntryDto);
  const entryEmployeeIds = [...new Set(entryRows.map((row) => row.employeeId))];

  const activeEmployeeRows = await db
    .select()
    .from(employees)
    .where(and(eq(employees.departmentId, departmentId), eq(employees.status, 'active')))
    .orderBy(asc(employees.employeeNo), asc(employees.id));

  let inactiveWithEntries: typeof employees.$inferSelect[] = [];
  if (entryEmployeeIds.length > 0) {
    inactiveWithEntries = await db
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

  const employeeMap = new Map<number, EmployeeDto>();
  for (const row of [...activeEmployeeRows, ...inactiveWithEntries]) {
    employeeMap.set(row.id, toEmployeeDto(row));
  }

  const gridEmployees = [...employeeMap.values()].sort((a, b) =>
    a.employeeNo.localeCompare(b.employeeNo, 'zh-CN'),
  );

  const shiftTypeList = await listShiftTypes(departmentId);
  const activeShiftTypes = shiftTypeList.filter((shiftType) => shiftType.status === 'active');
  const dailyCoverage = computeDailyCoverage(periodRow.weekStart, activeShiftTypes, entries);
  const warnings = buildScheduleWarnings({
    weekStart: periodRow.weekStart,
    shiftTypes: shiftTypeList,
    entries,
    employees: gridEmployees,
  });

  return {
    period: {
      id: periodRow.id,
      weekStart: periodRow.weekStart,
      editStatus: periodRow.editStatus,
      hasUnpublishedChanges: periodRow.hasUnpublishedChanges,
      latestPublishedVersion: periodRow.latestPublishedVersion,
      lastPublishedAt: periodRow.lastPublishedAt,
    },
    employees: gridEmployees,
    shiftTypes: shiftTypeList,
    entries,
    dailyCoverage,
    warnings,
  };
}
