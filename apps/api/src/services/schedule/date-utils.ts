import dayjs from 'dayjs';

export function addDays(dateStr: string, days: number): string {
  return dayjs(dateStr).add(days, 'day').format('YYYY-MM-DD');
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function isDateInWeek(workDate: string, weekStart: string): boolean {
  return getWeekDates(weekStart).includes(workDate);
}

/** ISO weekday: Monday = 1, Sunday = 7 */
export function isoWeekday(workDate: string): number {
  const weekday = dayjs(workDate).day();
  return weekday === 0 ? 7 : weekday;
}
