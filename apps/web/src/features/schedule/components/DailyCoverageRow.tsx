import type { DailyCoverageItemDto, ShiftTypeDto } from '@easyshift/shared-types';
import { getWeekDates, formatWeekdayLabel } from '../utils';

interface DailyCoverageRowProps {
  weekStart: string;
  dailyCoverage: DailyCoverageItemDto[];
  activeShiftTypes: ShiftTypeDto[];
}

function isBelowMin(assigned: number, min: number): boolean {
  return min > 0 && assigned < min;
}

function shouldShowCoverageItem(assigned: number, min: number): boolean {
  return assigned > 0 || min > 0;
}

function formatCoverageText(code: string, assigned: number, min: number): string {
  if (min === 0) {
    return `${code}: ${assigned}`;
  }

  return `${code}: ${assigned}/${min}`;
}

export function DailyCoverageRow({
  weekStart,
  dailyCoverage,
  activeShiftTypes,
}: DailyCoverageRowProps) {
  const weekDates = getWeekDates(weekStart);
  const coverageByDate = new Map(dailyCoverage.map((item) => [item.workDate, item]));

  if (activeShiftTypes.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto border-t border-gray-200 bg-gray-50">
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="sticky left-0 z-10 w-36 min-w-36 border-r border-gray-200 bg-gray-50 px-3 py-2 font-medium text-gray-600">
              覆盖统计
            </td>
            {weekDates.map((workDate) => {
              const coverage = coverageByDate.get(workDate);
              const byShift = new Map(
                coverage?.byShiftType.map((item) => [item.shiftTypeId, item]) ?? [],
              );
              const visibleStats = activeShiftTypes
                .map((shiftType) => {
                  const stat = byShift.get(shiftType.id);
                  const assigned = stat?.assignedCount ?? 0;
                  const min = stat?.minRequiredCount ?? shiftType.minRequiredCount;
                  return { shiftType, assigned, min };
                })
                .filter(({ assigned, min }) => shouldShowCoverageItem(assigned, min));

              return (
                <td
                  key={workDate}
                  className="min-w-24 border-r border-gray-100 px-2 py-2 align-top last:border-r-0"
                >
                  <div className="mb-1 text-xs text-gray-400">{formatWeekdayLabel(workDate)}</div>
                  <div className="space-y-0.5">
                    {visibleStats.map(({ shiftType, assigned, min }) => {
                      const below = isBelowMin(assigned, min);

                      return (
                        <div
                          key={shiftType.id}
                          className={`text-xs ${below ? 'font-medium text-red-600' : 'text-gray-600'}`}
                        >
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: shiftType.color }}
                          />
                          {formatCoverageText(shiftType.code, assigned, min)}
                        </div>
                      );
                    })}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
