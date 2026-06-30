import type { ScheduleChangeLogDto } from '@easyshift/shared-types';
import { describe, expect, it } from 'vitest';
import {
  formatChangeLogSummary,
  formatOperatorLabel,
  getChangeLogActionLabel,
} from '../change-log-utils';

const employees = [{ id: 1, employeeNo: 'E001', name: '张三', title: null, phone: '13800000001', status: 'active' as const }];
const shiftTypes = [
  {
    id: 1,
    code: 'D',
    name: '日班',
    kind: 'day' as const,
    startTime: '08:00:00',
    durationMinutes: 480,
    color: '#4CAF50',
    minRequiredCount: 1,
    status: 'active' as const,
    sortOrder: 1,
  },
];

describe('change-log-utils', () => {
  it('maps action to Chinese label', () => {
    expect(getChangeLogActionLabel('entry_upsert')).toBe('保存排班');
    expect(getChangeLogActionLabel('publish')).toBe('发布排班');
  });

  it('formats entry_upsert summary with employee and shift names', () => {
    const log: ScheduleChangeLogDto = {
      id: 1,
      periodId: 1,
      weekStart: '2026-06-22',
      action: 'entry_upsert',
      operator: { id: 1, phone: '13800138000' },
      detail: {
        entries: [{ employeeId: 1, workDate: '2026-06-22', shiftTypeId: 1, note: null }],
      },
      createdAt: '2026-06-24T10:00:00+08:00',
    };

    expect(formatChangeLogSummary(log, employees, shiftTypes)).toBe(
      '张三 · 2026-06-22 → D 日班',
    );
  });

  it('formats publish summary', () => {
    const log: ScheduleChangeLogDto = {
      id: 2,
      periodId: 1,
      weekStart: '2026-06-22',
      action: 'publish',
      operator: { id: 1, phone: '13800138000' },
      detail: { version: 2 },
      createdAt: '2026-06-24T11:00:00+08:00',
    };

    expect(formatChangeLogSummary(log, employees, shiftTypes)).toBe('版本 v2');
  });

  it('falls back when operator phone is missing', () => {
    expect(formatOperatorLabel(null)).toBe('未知操作人');
  });
});
