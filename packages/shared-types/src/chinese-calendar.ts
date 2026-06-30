import dayjs from 'dayjs';
import { CHINESE_CALENDAR_DATA, type ChineseCalendarDataSource } from './chinese-calendar-data.js';

export type CalendarDayHint =
  | { type: 'holiday'; name: string }
  | { type: 'weekend' }
  | { type: 'compensatory_work' };

function buildHolidayMap(dataSource: ChineseCalendarDataSource): Map<string, string> {
  const map = new Map<string, string>();
  for (const { from, to, name } of dataSource.holidayRanges) {
    let cursor = dayjs(from);
    const end = dayjs(to);
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      map.set(cursor.format('YYYY-MM-DD'), name);
      cursor = cursor.add(1, 'day');
    }
  }
  return map;
}

function isWeekend(workDate: string): boolean {
  const day = dayjs(workDate).day();
  return day === 0 || day === 6;
}

export function createCalendarDayHintResolver(dataSource: ChineseCalendarDataSource) {
  const holidayByDate = buildHolidayMap(dataSource);
  const compensatoryWorkDates = new Set(dataSource.compensatoryWorkDates);

  return function resolveCalendarDayHint(workDate: string): CalendarDayHint | null {
    const holidayName = holidayByDate.get(workDate);
    if (holidayName) {
      return { type: 'holiday', name: holidayName };
    }

    if (compensatoryWorkDates.has(workDate)) {
      return { type: 'compensatory_work' };
    }

    if (isWeekend(workDate)) {
      return { type: 'weekend' };
    }

    return null;
  };
}

const defaultCalendarDayHintResolver = createCalendarDayHintResolver(CHINESE_CALENDAR_DATA);

export function getChineseCalendarDataSource(): ChineseCalendarDataSource {
  return CHINESE_CALENDAR_DATA;
}

export function isChineseCalendarYearCovered(year: number): boolean {
  return CHINESE_CALENDAR_DATA.coveredYears.includes(year);
}

export function getCalendarDayHint(workDate: string): CalendarDayHint | null {
  return defaultCalendarDayHintResolver(workDate);
}

export function getCalendarDayLabel(hint: CalendarDayHint): string {
  switch (hint.type) {
    case 'holiday':
      return hint.name;
    case 'weekend':
      return '休';
    case 'compensatory_work':
      return '班';
  }
}
