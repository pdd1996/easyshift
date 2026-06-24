import type { ScheduleEntryDto, StaffScheduleDayDto, StaffScheduleDto } from '@easyshift/shared-types';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  employees,
  schedulePeriods,
  schedulePublishSnapshots,
} from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { getWeekDates, isoWeekday } from '../schedule/date-utils.js';
import type { SnapshotData, SnapshotShiftType } from '../schedule/snapshot-types.js';

function notPublishedResponse(weekStart: string): StaffScheduleDto {
  return {
    weekStart,
    publishedAt: null,
    version: null,
    status: 'not_published',
    days: [],
  };
}

function buildDays(
  weekStart: string,
  employeeEntries: ScheduleEntryDto[],
  shiftTypes: SnapshotShiftType[],
): StaffScheduleDayDto[] {
  const shiftTypeMap = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  const entryByDate = new Map(employeeEntries.map((entry) => [entry.workDate, entry]));

  return getWeekDates(weekStart).map((workDate) => {
    const entry = entryByDate.get(workDate);
    if (!entry) {
      return { workDate, weekday: isoWeekday(workDate), shift: null, note: null };
    }

    const shiftType = shiftTypeMap.get(entry.shiftTypeId);
    if (!shiftType) {
      return { workDate, weekday: isoWeekday(workDate), shift: null, note: entry.note };
    }

    return {
      workDate,
      weekday: isoWeekday(workDate),
      shift: {
        code: shiftType.code,
        name: shiftType.name,
        startTime: shiftType.startTime,
        durationMinutes: shiftType.durationMinutes,
        color: shiftType.color,
      },
      note: entry.note,
    };
  });
}

export async function getStaffSchedule(
  employeeId: number,
  weekStart: string,
): Promise<StaffScheduleDto> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    throw new AppError(404, 'NOT_FOUND', '员工不存在');
  }

  const [period] = await db
    .select()
    .from(schedulePeriods)
    .where(
      and(
        eq(schedulePeriods.departmentId, employee.departmentId),
        eq(schedulePeriods.weekStart, weekStart),
      ),
    )
    .limit(1);

  if (!period || period.latestPublishedVersion == null) {
    return notPublishedResponse(weekStart);
  }

  const [snapshot] = await db
    .select()
    .from(schedulePublishSnapshots)
    .where(
      and(
        eq(schedulePublishSnapshots.periodId, period.id),
        eq(schedulePublishSnapshots.version, period.latestPublishedVersion),
      ),
    )
    .limit(1);

  if (!snapshot) {
    console.error(
      `[staff-schedule] missing snapshot for period ${period.id}, version ${period.latestPublishedVersion}`,
    );
    return notPublishedResponse(weekStart);
  }

  const snapshotData = snapshot.snapshotData as SnapshotData;
  const snapshotWeekStart = snapshotData.meta.weekStart;

  if (weekStart !== snapshotWeekStart) {
    console.error(
      `[staff-schedule] weekStart mismatch: request=${weekStart}, snapshot=${snapshotWeekStart}, period=${period.id}`,
    );
  }

  const employeeEntries = snapshotData.entries.filter((entry) => entry.employeeId === employeeId);

  return {
    weekStart: snapshotWeekStart,
    publishedAt: snapshotData.meta.publishedAt,
    version: snapshotData.meta.version,
    days: buildDays(snapshotWeekStart, employeeEntries, snapshotData.shiftTypes),
  };
}
