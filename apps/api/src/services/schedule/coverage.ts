import type { DailyCoverageItemDto, ScheduleEntryDto, ShiftTypeDto } from '@easyshift/shared-types';
import { getWeekDates } from './date-utils.js';

export function computeDailyCoverage(
  weekStart: string,
  shiftTypes: ShiftTypeDto[],
  entries: ScheduleEntryDto[],
): DailyCoverageItemDto[] {
  const weekDates = getWeekDates(weekStart);

  return weekDates.map((workDate) => {
    const dayEntries = entries.filter((entry) => entry.workDate === workDate);

    return {
      workDate,
      byShiftType: shiftTypes.map((shiftType) => ({
        shiftTypeId: shiftType.id,
        code: shiftType.code,
        assignedCount: dayEntries.filter((entry) => entry.shiftTypeId === shiftType.id).length,
        minRequiredCount: shiftType.minRequiredCount,
      })),
    };
  });
}

export function buildCoverageWarnings(
  dailyCoverage: DailyCoverageItemDto[],
): Array<{
  code: string;
  workDate?: string;
  shiftTypeId?: number;
  message: string;
}> {
  const warnings: Array<{
    code: string;
    workDate?: string;
    shiftTypeId?: number;
    message: string;
  }> = [];

  for (const day of dailyCoverage) {
    for (const item of day.byShiftType) {
      if (item.assignedCount < item.minRequiredCount) {
        warnings.push({
          code: 'COVERAGE_BELOW_MIN',
          workDate: day.workDate,
          shiftTypeId: item.shiftTypeId,
          message: `${item.code} 仅 ${item.assignedCount} 人，低于最低 ${item.minRequiredCount} 人`,
        });
      }
    }
  }

  return warnings;
}
