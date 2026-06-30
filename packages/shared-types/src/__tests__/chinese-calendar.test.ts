import { describe, expect, it } from 'vitest';
import {
  createCalendarDayHintResolver,
  getCalendarDayHint,
  getCalendarDayLabel,
  getChineseCalendarDataSource,
  isChineseCalendarYearCovered,
} from '../chinese-calendar.js';

describe('getCalendarDayHint', () => {
  it('returns holiday name for statutory holidays', () => {
    expect(getCalendarDayHint('2026-06-19')).toEqual({ type: 'holiday', name: '端午' });
    expect(getCalendarDayHint('2026-02-15')).toEqual({ type: 'holiday', name: '春节' });
  });

  it('returns weekend for regular Saturday and Sunday', () => {
    expect(getCalendarDayHint('2026-06-27')).toEqual({ type: 'weekend' });
    expect(getCalendarDayHint('2026-06-28')).toEqual({ type: 'weekend' });
  });

  it('returns compensatory work for adjusted workdays on weekends', () => {
    expect(getCalendarDayHint('2026-02-14')).toEqual({ type: 'compensatory_work' });
    expect(getCalendarDayHint('2026-01-04')).toEqual({ type: 'compensatory_work' });
  });

  it('prefers holiday over weekend when both apply', () => {
    expect(getCalendarDayHint('2026-06-21')).toEqual({ type: 'holiday', name: '端午' });
  });

  it('returns null for regular workdays', () => {
    expect(getCalendarDayHint('2026-06-22')).toBeNull();
    expect(getCalendarDayHint('2026-06-24')).toBeNull();
  });

  it('can resolve against an injected data source', () => {
    const resolve = createCalendarDayHintResolver({
      source: 'test',
      updatedAt: '2026-06-30',
      coveredYears: [2030],
      holidayRanges: [{ from: '2030-01-01', to: '2030-01-02', name: '测试节日' }],
      compensatoryWorkDates: ['2030-01-06'],
    });

    expect(resolve('2030-01-01')).toEqual({ type: 'holiday', name: '测试节日' });
    expect(resolve('2030-01-06')).toEqual({ type: 'compensatory_work' });
  });

  it('exposes calendar data source metadata', () => {
    expect(getChineseCalendarDataSource().coveredYears).toEqual([2025, 2026]);
    expect(isChineseCalendarYearCovered(2026)).toBe(true);
    expect(isChineseCalendarYearCovered(2027)).toBe(false);
  });
});

describe('getCalendarDayLabel', () => {
  it('maps hint types to display labels', () => {
    expect(getCalendarDayLabel({ type: 'holiday', name: '端午' })).toBe('端午');
    expect(getCalendarDayLabel({ type: 'weekend' })).toBe('休');
    expect(getCalendarDayLabel({ type: 'compensatory_work' })).toBe('班');
  });
});
