export interface CalendarHolidayRange {
  from: string;
  to: string;
  name: string;
}

export interface ChineseCalendarDataSource {
  source: string;
  updatedAt: string;
  coveredYears: number[];
  holidayRanges: CalendarHolidayRange[];
  compensatoryWorkDates: string[];
}

export const CHINESE_CALENDAR_DATA: ChineseCalendarDataSource = {
  source: '国务院办公厅部分节假日安排通知',
  updatedAt: '2026-06-30',
  coveredYears: [2025, 2026],
  holidayRanges: [
    // 2025
    { from: '2025-01-01', to: '2025-01-01', name: '元旦' },
    { from: '2025-01-28', to: '2025-02-04', name: '春节' },
    { from: '2025-04-04', to: '2025-04-06', name: '清明' },
    { from: '2025-05-01', to: '2025-05-05', name: '劳动节' },
    { from: '2025-05-31', to: '2025-06-02', name: '端午' },
    { from: '2025-10-01', to: '2025-10-08', name: '国庆·中秋' },
    // 2026
    { from: '2026-01-01', to: '2026-01-03', name: '元旦' },
    { from: '2026-02-15', to: '2026-02-23', name: '春节' },
    { from: '2026-04-04', to: '2026-04-06', name: '清明' },
    { from: '2026-05-01', to: '2026-05-05', name: '劳动节' },
    { from: '2026-06-19', to: '2026-06-21', name: '端午' },
    { from: '2026-09-25', to: '2026-09-27', name: '中秋' },
    { from: '2026-10-01', to: '2026-10-07', name: '国庆' },
  ],
  compensatoryWorkDates: [
    // 2025
    '2025-01-26',
    '2025-02-08',
    '2025-04-27',
    '2025-09-28',
    '2025-10-11',
    // 2026
    '2026-01-04',
    '2026-02-14',
    '2026-02-28',
    '2026-05-09',
    '2026-09-20',
    '2026-10-10',
  ],
};
