import { describe, expect, it } from 'vitest';
import { isMonday, weekStartFromDate } from '../index.js';

describe('weekStartFromDate', () => {
  it('returns Monday for a Wednesday', () => {
    expect(weekStartFromDate(new Date('2026-06-25T12:00:00+08:00'))).toBe('2026-06-22');
  });

  it('returns same date when input is Monday', () => {
    expect(weekStartFromDate(new Date('2026-06-22T12:00:00+08:00'))).toBe('2026-06-22');
  });

  it('uses Asia/Shanghai calendar day even when server timezone differs', () => {
    // Monday 01:30 UTC = Monday 09:30 in Shanghai
    expect(weekStartFromDate(new Date('2026-06-22T01:30:00Z'))).toBe('2026-06-22');
    // Sunday 20:00 UTC = Monday 04:00 in Shanghai → week starts on that Monday
    expect(weekStartFromDate(new Date('2026-06-21T20:00:00Z'))).toBe('2026-06-22');
  });
});

describe('isMonday', () => {
  it('detects Monday', () => {
    expect(isMonday('2026-06-22')).toBe(true);
    expect(isMonday('2026-06-23')).toBe(false);
  });
});
