import { http, HttpResponse } from 'msw';
import type { ScheduleChangeLogDto } from '@easyshift/shared-types';
import {
  buildMockScheduleGrid,
  mockPeriod,
  mockScheduleWarnings,
  mockShiftTypes,
} from './fixtures';
import { TEST_API_BASE } from './constants';

export const mockChangeLogs: ScheduleChangeLogDto[] = [
  {
    id: 1,
    periodId: mockPeriod.id,
    weekStart: mockPeriod.weekStart,
    action: 'entry_upsert',
    operator: { id: 1, phone: '13800138000' },
    detail: {
      entries: [{ employeeId: 1, workDate: '2026-06-22', shiftTypeId: 1, note: null }],
    },
    createdAt: '2026-06-24T10:00:00+08:00',
  },
  {
    id: 2,
    periodId: mockPeriod.id,
    weekStart: mockPeriod.weekStart,
    action: 'entry_delete',
    operator: { id: 1, phone: '13800138000' },
    detail: { employeeId: 1, workDate: '2026-06-22' },
    createdAt: '2026-06-23T10:00:00+08:00',
  },
];

export const mockChangeLogFilterOptions = {
  operators: [{ id: 1, phone: '13800138000' }],
  periods: [{ id: mockPeriod.id, weekStart: mockPeriod.weekStart }],
  actions: ['entry_upsert', 'entry_delete', 'copy_from_week', 'publish', 'period_create'] as const,
};

export const handlers = [
  http.get(`${TEST_API_BASE}/shift-types`, () => {
    return HttpResponse.json({ data: mockShiftTypes });
  }),

  http.get(`${TEST_API_BASE}/schedule/periods`, () => {
    return HttpResponse.json({ data: [mockPeriod] });
  }),

  http.get(`${TEST_API_BASE}/schedule/periods/:periodId/grid`, () => {
    return HttpResponse.json({ data: buildMockScheduleGrid() });
  }),

  http.get(`${TEST_API_BASE}/schedule/change-logs`, () => {
    return HttpResponse.json({
      data: mockChangeLogs,
      meta: { page: 1, pageSize: 20, total: mockChangeLogs.length },
    });
  }),

  http.get(`${TEST_API_BASE}/schedule/change-logs/filter-options`, () => {
    return HttpResponse.json({ data: mockChangeLogFilterOptions });
  }),
];

export { buildMockScheduleGrid, mockPeriod, mockScheduleWarnings, mockShiftTypes };
