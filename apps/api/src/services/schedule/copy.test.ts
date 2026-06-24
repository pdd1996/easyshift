import { describe, expect, it } from 'vitest';
import { mapSourceDateToTarget } from './copy.js';

describe('mapSourceDateToTarget', () => {
  it('[u1] maps source week entry dates forward by 7 days to the target week (AC-04)', () => {
    const sourceWeekStart = '2026-06-15';
    const targetWeekStart = '2026-06-22';

    expect(mapSourceDateToTarget('2026-06-15', sourceWeekStart, targetWeekStart)).toBe('2026-06-22');
    expect(mapSourceDateToTarget('2026-06-16', sourceWeekStart, targetWeekStart)).toBe('2026-06-23');
    expect(mapSourceDateToTarget('2026-06-21', sourceWeekStart, targetWeekStart)).toBe('2026-06-28');
  });
});
