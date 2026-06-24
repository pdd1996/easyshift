import type {
  DailyCoverageItemDto,
  EmployeeDto,
  ScheduleEntryDto,
  ShiftTypeDto,
} from '@easyshift/shared-types';
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

export function buildMockEmployees(count: number): EmployeeDto[] {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      id,
      employeeNo: `E${String(id).padStart(3, '0')}`,
      name: `员工${id}`,
      title: '护士',
      phone: `138${String(id).padStart(8, '0')}`,
      status: 'active',
    };
  });
}

export const mockEmployees: EmployeeDto[] = buildMockEmployees(1);

export const mockTenEmployees: EmployeeDto[] = buildMockEmployees(10);

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

function countEntriesForCoverage(
  entries: ScheduleEntryDto[],
  workDate: string,
  shiftTypeId: number,
): number {
  return entries.filter(
    (entry) => entry.workDate === workDate && entry.shiftTypeId === shiftTypeId,
  ).length;
}

function buildDailyCoverage(
  weekStart: string,
  shiftTypes: ShiftTypeDto[],
  entries: ScheduleEntryDto[] = [],
): DailyCoverageItemDto[] {
  return Array.from({ length: 7 }, (_, index) => {
    const workDate = dayjs(weekStart).add(index, 'day').format('YYYY-MM-DD');
    return {
      workDate,
      byShiftType: shiftTypes
        .filter((shiftType) => shiftType.status === 'active')
        .map((shiftType) => ({
          shiftTypeId: shiftType.id,
          code: shiftType.code,
          assignedCount: countEntriesForCoverage(entries, workDate, shiftType.id),
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

export function buildMockScheduleGrid(options?: {
  warnings?: typeof mockScheduleWarnings;
  employees?: EmployeeDto[];
  entries?: ScheduleEntryDto[];
}) {
  const employees = options?.employees ?? mockEmployees;
  const entries = options?.entries ?? [];

  return {
    period: {
      id: mockPeriod.id,
      weekStart: mockPeriod.weekStart,
      editStatus: mockPeriod.editStatus,
      hasUnpublishedChanges: mockPeriod.hasUnpublishedChanges,
      latestPublishedVersion: mockPeriod.latestPublishedVersion,
      lastPublishedAt: mockPeriod.lastPublishedAt,
    },
    employees,
    shiftTypes: mockShiftTypes,
    entries,
    dailyCoverage: buildDailyCoverage(MOCK_WEEK_START, mockShiftTypes, entries),
    warnings: options?.warnings ?? [],
  };
}
