import { http, HttpResponse } from 'msw';
import {
  buildMockScheduleGrid,
  mockPeriod,
  mockScheduleWarnings,
  mockShiftTypes,
} from './fixtures';
import { TEST_API_BASE } from './constants';

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
];

export { buildMockScheduleGrid, mockPeriod, mockScheduleWarnings, mockShiftTypes };
