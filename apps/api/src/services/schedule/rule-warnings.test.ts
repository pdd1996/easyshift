import type { EmployeeDto, ScheduleEntryDto, ShiftTypeDto } from '@easyshift/shared-types';
import { describe, expect, it } from 'vitest';
import { buildRuleWarnings } from './rule-warnings.js';

const employee: EmployeeDto = {
  id: 1,
  employeeNo: '001',
  name: '张三',
  title: '护士',
  phone: '13800000001',
  status: 'active',
};

const dayShift: ShiftTypeDto = {
  id: 10,
  code: 'D',
  name: '白班',
  kind: 'day',
  startTime: '08:00:00',
  durationMinutes: 480,
  color: '#4CAF50',
  minRequiredCount: 3,
  status: 'active',
  sortOrder: 1,
};

const eveningShift: ShiftTypeDto = {
  id: 11,
  code: 'E',
  name: '小夜班',
  kind: 'evening',
  startTime: '16:00:00',
  durationMinutes: 480,
  color: '#FF9800',
  minRequiredCount: 2,
  status: 'active',
  sortOrder: 2,
};

const nightShift: ShiftTypeDto = {
  id: 12,
  code: 'N',
  name: '大夜班',
  kind: 'night',
  startTime: '20:00:00',
  durationMinutes: 720,
  color: '#3F51B5',
  minRequiredCount: 1,
  status: 'active',
  sortOrder: 3,
};

const localizedNightShift: ShiftTypeDto = {
  ...nightShift,
  id: 13,
  code: '夜',
  name: '夜班',
};

const localizedDayShift: ShiftTypeDto = {
  ...dayShift,
  id: 14,
  code: '白',
  name: '日班',
};

const shiftTypes = [dayShift, eveningShift, nightShift, localizedNightShift, localizedDayShift];

function entry(workDate: string, shiftTypeId: number): ScheduleEntryDto {
  return {
    employeeId: employee.id,
    workDate,
    shiftTypeId,
    note: null,
  };
}

describe('buildRuleWarnings (AC-05 / WEB-VAL-02～03)', () => {
  it('[u3] warns when employee has more than 2 consecutive night shifts', () => {
    const warnings = buildRuleWarnings({
      entries: [
        entry('2026-06-22', nightShift.id),
        entry('2026-06-23', nightShift.id),
        entry('2026-06-24', nightShift.id),
      ],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'CONSECUTIVE_NIGHT')).toBe(true);
    expect(warnings.find((warning) => warning.code === 'CONSECUTIVE_NIGHT')?.message).toContain('连续 3 天');
  });

  it('does not warn for exactly 2 consecutive night shifts', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', nightShift.id), entry('2026-06-23', nightShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'CONSECUTIVE_NIGHT')).toBe(false);
  });

  it('[u2] warns when day shift starts within 24h after night shift ends', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', nightShift.id), entry('2026-06-23', dayShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'REST_VIOLATION')).toBe(true);
  });

  it('uses kind rather than code for localized shift labels', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', localizedNightShift.id), entry('2026-06-23', localizedDayShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'REST_VIOLATION')).toBe(true);
    expect(warnings.some((warning) => warning.code === 'CONSECUTIVE_NIGHT')).toBe(false);
  });

  it('does not warn when day shift starts after 24h rest following night shift', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', nightShift.id), entry('2026-06-24', dayShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'REST_VIOLATION')).toBe(false);
  });

  it('does not warn for short rest between non night-to-day shift pairs', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', eveningShift.id), entry('2026-06-23', dayShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings).toHaveLength(0);
  });

  it('does not warn for non-consecutive night shifts', () => {
    const warnings = buildRuleWarnings({
      entries: [entry('2026-06-22', nightShift.id), entry('2026-06-24', nightShift.id)],
      shiftTypes,
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'CONSECUTIVE_NIGHT')).toBe(false);
  });
});
