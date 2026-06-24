import type {
  DailyCoverageItemDto,
  EmployeeDto,
  ScheduleEntryDto,
  ShiftTypeDto,
} from '@easyshift/shared-types';
import { buildCoverageWarnings, computeDailyCoverage } from './coverage.js';
import { buildRuleWarnings } from './rule-warnings.js';
import type { ScheduleWarning } from './validation.js';

export function buildScheduleWarnings(params: {
  weekStart: string;
  shiftTypes: ShiftTypeDto[];
  entries: ScheduleEntryDto[];
  employees: EmployeeDto[];
  dailyCoverage?: DailyCoverageItemDto[];
}): ScheduleWarning[] {
  const activeShiftTypes = params.shiftTypes.filter((shiftType) => shiftType.status === 'active');
  const dailyCoverage =
    params.dailyCoverage ??
    computeDailyCoverage(params.weekStart, activeShiftTypes, params.entries);
  const coverageWarnings = buildCoverageWarnings(dailyCoverage);
  const ruleWarnings = buildRuleWarnings({
    entries: params.entries,
    shiftTypes: params.shiftTypes,
    employees: params.employees,
  });

  return [...coverageWarnings, ...ruleWarnings];
}
