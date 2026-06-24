import type { DailyCoverageItemDto, EmployeeDto, ShiftTypeDto } from '@easyshift/shared-types';
import dayjs from 'dayjs';
import type { PeriodDto } from '@/features/schedule/api';

export const MOCK_WEEK_START = '2026-06-22';
export const MOCK_PERIOD_ID = 1;

export const mockShiftTypes: ShiftTypeDto[] = [
  {
    id: 1,
    code: 'D',
    name: '日班',
    kind: 'day',
    startTime: '08:00:00',
    durationMinutes: 480,
    color: '#4CAF50',
    minRequiredCount: 3,
    status: 'active',
    sortOrder: 1,
  },
  {
    id: 2,
    code: 'N',
    name: '夜班',
    kind: 'night',
    startTime: '20:00:00',
    durationMinutes: 720,
    color: '#2196F3',
    minRequiredCount: 1,
    status: 'active',
    sortOrder: 2,
  },
];

export const mockEmployees: EmployeeDto[] = [
  {
    id: 1,
    employeeNo: 'E001',
    name: '张三',
    title: '护士',
    phone: '13800000001',
    status: 'active',
  },
];

export const mockPeriod: PeriodDto = {
  id: MOCK_PERIOD_ID,
  weekStart: MOCK_WEEK_START,
  editStatus: 'draft',
  hasUnpublishedChanges: false,
  latestPublishedVersion: null,
  lastPublishedAt: null,
  createdAt: '2026-06-22T00:00:00.000Z',
  updatedAt: '2026-06-22T00:00:00.000Z',
};

function buildDailyCoverage(weekStart: string, shiftTypes: ShiftTypeDto[]): DailyCoverageItemDto[] {
  return Array.from({ length: 7 }, (_, index) => {
    const workDate = dayjs(weekStart).add(index, 'day').format('YYYY-MM-DD');
    return {
      workDate,
      byShiftType: shiftTypes
        .filter((shiftType) => shiftType.status === 'active')
        .map((shiftType) => ({
          shiftTypeId: shiftType.id,
          code: shiftType.code,
          assignedCount: 0,
          minRequiredCount: shiftType.minRequiredCount,
        })),
    };
  });
}

export const mockScheduleWarnings = [
  {
    code: 'COVERAGE_BELOW_MIN',
    workDate: MOCK_WEEK_START,
    shiftTypeId: 2,
    message: '2026-06-22 大夜班覆盖不足（0/1）',
  },
];

export function buildMockScheduleGrid(options?: { warnings?: typeof mockScheduleWarnings }) {
  return {
    period: {
      id: mockPeriod.id,
      weekStart: mockPeriod.weekStart,
      editStatus: mockPeriod.editStatus,
      hasUnpublishedChanges: mockPeriod.hasUnpublishedChanges,
      latestPublishedVersion: mockPeriod.latestPublishedVersion,
      lastPublishedAt: mockPeriod.lastPublishedAt,
    },
    employees: mockEmployees,
    shiftTypes: mockShiftTypes,
    entries: [],
    dailyCoverage: buildDailyCoverage(MOCK_WEEK_START, mockShiftTypes),
    warnings: options?.warnings ?? [],
  };
}
