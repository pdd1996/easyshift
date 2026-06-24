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
