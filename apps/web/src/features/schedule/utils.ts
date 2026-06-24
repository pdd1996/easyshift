import type { ScheduleEntryDto } from '@easyshift/shared-types';
import dayjs from 'dayjs';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function addWeeks(weekStart: string, weeks: number): string {
  return dayjs(weekStart).add(weeks * 7, 'day').format('YYYY-MM-DD');
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'),
  );
}

export function formatWeekdayLabel(workDate: string): string {
  const index = dayjs(workDate).day();
  return WEEKDAY_LABELS[index === 0 ? 6 : index - 1]!;
}

export function formatWeekRange(weekStart: string): string {
  const end = dayjs(weekStart).add(6, 'day');
  return `${dayjs(weekStart).format('M月D日')} – ${end.format('M月D日')}`;
}

export function buildEntryMap(entries: ScheduleEntryDto[]): Map<string, ScheduleEntryDto> {
  const map = new Map<string, ScheduleEntryDto>();
  for (const entry of entries) {
    map.set(`${entry.employeeId}:${entry.workDate}`, entry);
  }
  return map;
}

export function entryKey(employeeId: number, workDate: string): string {
  return `${employeeId}:${workDate}`;
}
