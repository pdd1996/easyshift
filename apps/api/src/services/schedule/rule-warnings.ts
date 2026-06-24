import type { EmployeeDto, ScheduleEntryDto, ShiftTypeDto, ShiftTypeKind } from '@easyshift/shared-types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { addDays } from './date-utils.js';
import type { ScheduleWarning } from './validation.js';

dayjs.extend(utc);

export interface RuleValidationConfig {
  /** 连续大夜班超过此天数时警告，默认 2（即 3 天连排才警告） */
  maxConsecutiveNights: number;
  /** 大夜班结束后排白班的最小休息小时数，默认 24 */
  minRestAfterNightHours: number;
}

export const DEFAULT_RULE_VALIDATION_CONFIG: RuleValidationConfig = {
  maxConsecutiveNights: 2,
  minRestAfterNightHours: 24,
};

interface TimedShiftInstance {
  workDate: string;
  shiftTypeId: number;
  kind: ShiftTypeKind;
  code: string;
  name: string;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
}

function parseShiftStart(workDate: string, startTime: string): dayjs.Dayjs {
  const timePart = startTime.slice(0, 8);
  return dayjs(`${workDate}T${timePart}`).utcOffset(8, true);
}

function toTimedShiftInstance(
  entry: ScheduleEntryDto,
  shiftType: ShiftTypeDto,
): TimedShiftInstance | null {
  if (!shiftType.startTime || shiftType.durationMinutes == null) {
    return null;
  }

  const start = parseShiftStart(entry.workDate, shiftType.startTime);
  const end = start.add(shiftType.durationMinutes, 'minute');

  return {
    workDate: entry.workDate,
    shiftTypeId: shiftType.id,
    kind: shiftType.kind,
    code: shiftType.code,
    name: shiftType.name,
    start,
    end,
  };
}

function isNightShift(kind: ShiftTypeKind): boolean {
  return kind === 'night';
}

function isDayShift(kind: ShiftTypeKind): boolean {
  return kind === 'day';
}

function formatDateLabel(workDate: string): string {
  return workDate.slice(5);
}

function findConsecutiveDateRuns(dates: string[]): string[][] {
  if (dates.length === 0) {
    return [];
  }

  const sorted = [...dates].sort();
  const runs: string[][] = [[sorted[0]!]];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const lastRun = runs[runs.length - 1]!;

    if (addDays(previous, 1) === current) {
      lastRun.push(current);
    } else {
      runs.push([current]);
    }
  }

  return runs;
}

function buildConsecutiveNightWarnings(
  employee: EmployeeDto,
  nightDates: string[],
  config: RuleValidationConfig,
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  for (const run of findConsecutiveDateRuns(nightDates)) {
    if (run.length <= config.maxConsecutiveNights) {
      continue;
    }

    const firstDate = run[0]!;
    const lastDate = run[run.length - 1]!;
    warnings.push({
      code: 'CONSECUTIVE_NIGHT',
      workDate: firstDate,
      message: `${employee.name} 连续 ${run.length} 天大夜班（${formatDateLabel(firstDate)}–${formatDateLabel(lastDate)}），超过上限 ${config.maxConsecutiveNights} 天`,
    });
  }

  return warnings;
}

function buildRestWarnings(
  employee: EmployeeDto,
  timedShifts: TimedShiftInstance[],
  config: RuleValidationConfig,
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const sorted = [...timedShifts].sort((left, right) => left.start.valueOf() - right.start.valueOf());

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const next = sorted[index]!;
    const gapHours = next.start.diff(previous.end, 'hour', true);

    if (isNightShift(previous.kind) && isDayShift(next.kind) && gapHours < config.minRestAfterNightHours) {
      warnings.push({
        code: 'REST_VIOLATION',
        workDate: next.workDate,
        shiftTypeId: next.shiftTypeId,
        message: `${employee.name} 在大夜班（${formatDateLabel(previous.workDate)}）结束后 ${Math.max(0, Math.round(gapHours))} 小时内又排白班（${formatDateLabel(next.workDate)}）`,
      });
    }
  }

  return warnings;
}

export function buildRuleWarnings(
  params: {
    entries: ScheduleEntryDto[];
    shiftTypes: ShiftTypeDto[];
    employees: EmployeeDto[];
    config?: Partial<RuleValidationConfig>;
  },
): ScheduleWarning[] {
  const config: RuleValidationConfig = {
    ...DEFAULT_RULE_VALIDATION_CONFIG,
    ...params.config,
  };

  const shiftTypeMap = new Map(params.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  const employeeMap = new Map(params.employees.map((employee) => [employee.id, employee]));
  const entriesByEmployee = new Map<number, ScheduleEntryDto[]>();

  for (const entry of params.entries) {
    const bucket = entriesByEmployee.get(entry.employeeId) ?? [];
    bucket.push(entry);
    entriesByEmployee.set(entry.employeeId, bucket);
  }

  const warnings: ScheduleWarning[] = [];

  for (const [employeeId, employeeEntries] of entriesByEmployee) {
    const employee = employeeMap.get(employeeId);
    if (!employee) {
      continue;
    }

    const nightDates: string[] = [];
    const timedShifts: TimedShiftInstance[] = [];

    for (const entry of employeeEntries) {
      const shiftType = shiftTypeMap.get(entry.shiftTypeId);
      if (!shiftType) {
        continue;
      }

      if (isNightShift(shiftType.kind)) {
        nightDates.push(entry.workDate);
      }

      const timedShift = toTimedShiftInstance(entry, shiftType);
      if (timedShift) {
        timedShifts.push(timedShift);
      }
    }

    warnings.push(...buildConsecutiveNightWarnings(employee, nightDates, config));
    warnings.push(...buildRestWarnings(employee, timedShifts, config));
  }

  return warnings;
}
