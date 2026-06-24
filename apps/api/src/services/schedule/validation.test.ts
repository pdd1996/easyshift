import type { EmployeeDto, ShiftTypeDto } from '@easyshift/shared-types';
import { describe, expect, it } from 'vitest';
import { buildScheduleWarnings } from './warnings.js';

const employee: EmployeeDto = {
  id: 1,
  employeeNo: '001',
  name: '李四',
  title: '护士',
  phone: '13800000002',
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

describe('buildScheduleWarnings', () => {
  it('[u4] merges coverage and rule warnings', () => {
    const warnings = buildScheduleWarnings({
      weekStart: '2026-06-22',
      shiftTypes: [dayShift, nightShift],
      entries: [
        {
          employeeId: employee.id,
          workDate: '2026-06-22',
          shiftTypeId: dayShift.id,
          note: null,
        },
        {
          employeeId: employee.id,
          workDate: '2026-06-22',
          shiftTypeId: nightShift.id,
          note: null,
        },
        {
          employeeId: employee.id,
          workDate: '2026-06-23',
          shiftTypeId: nightShift.id,
          note: null,
        },
        {
          employeeId: employee.id,
          workDate: '2026-06-24',
          shiftTypeId: nightShift.id,
          note: null,
        },
        {
          employeeId: employee.id,
          workDate: '2026-06-23',
          shiftTypeId: dayShift.id,
          note: null,
        },
      ],
      employees: [employee],
    });

    expect(warnings.some((warning) => warning.code === 'COVERAGE_BELOW_MIN')).toBe(true);
    expect(warnings.some((warning) => warning.code === 'CONSECUTIVE_NIGHT')).toBe(true);
    expect(warnings.some((warning) => warning.code === 'REST_VIOLATION')).toBe(true);
  });
});
