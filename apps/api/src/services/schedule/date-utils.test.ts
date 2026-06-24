import { describe, expect, it } from 'vitest';
import { addDays, getWeekDates, isDateInWeek } from './date-utils.js';

describe('schedule date utils', () => {
  it('treats YYYY-MM-DD values as date-only calendar days', () => {
    expect(addDays('2026-06-22', 0)).toBe('2026-06-22');
    expect(addDays('2026-06-22', 1)).toBe('2026-06-23');
    expect(addDays('2026-06-22', 6)).toBe('2026-06-28');
  });

  it('builds the seven calendar dates in a schedule week', () => {
    expect(getWeekDates('2026-06-22')).toEqual([
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
    ]);
  });

  it('checks whether a work date belongs to the schedule week', () => {
    expect(isDateInWeek('2026-06-22', '2026-06-22')).toBe(true);
    expect(isDateInWeek('2026-06-28', '2026-06-22')).toBe(true);
    expect(isDateInWeek('2026-06-29', '2026-06-22')).toBe(false);
  });
});
