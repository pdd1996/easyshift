import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export type UserRole = 'admin' | 'staff';

export type UserStatus = 'active' | 'disabled';

export type EmployeeStatus = 'active' | 'inactive';

export type PeriodEditStatus = 'draft' | 'published';

export type BindingCodeStatus = 'active' | 'used' | 'expired';

export type ShiftTypeStatus = 'active' | 'inactive';

export type { ShiftTypeKind } from './shift-type-kind.js';
export {
  SHIFT_TYPE_KINDS,
  SHIFT_TYPE_KIND_LABELS,
  inferShiftTypeKindFromCode,
} from './shift-type-kind.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface DepartmentDto {
  id: number;
  name: string;
}

export interface AdminUserDto {
  id: number;
  phone: string;
  role: 'admin';
}

import type { ShiftTypeKind } from './shift-type-kind.js';

export interface ShiftTypeDto {
  id: number;
  code: string;
  name: string;
  kind: ShiftTypeKind;
  startTime: string | null;
  durationMinutes: number | null;
  color: string;
  minRequiredCount: number;
  status: ShiftTypeStatus;
  sortOrder: number;
}

export interface EmployeeDto {
  id: number;
  employeeNo: string;
  name: string;
  title: string | null;
  phone: string;
  status: EmployeeStatus;
  bindingStatus?: 'bound' | 'unbound';
}

export interface ScheduleEntryDto {
  employeeId: number;
  workDate: string;
  shiftTypeId: number;
  note: string | null;
}

export interface DailyCoverageItemDto {
  workDate: string;
  byShiftType: Array<{
    shiftTypeId: number;
    code: string;
    assignedCount: number;
    minRequiredCount: number;
  }>;
}

export interface ScheduleGridDto {
  period: {
    id: number;
    weekStart: string;
    editStatus: PeriodEditStatus;
    hasUnpublishedChanges: boolean;
    latestPublishedVersion: number | null;
    lastPublishedAt: string | null;
  };
  employees: EmployeeDto[];
  shiftTypes: ShiftTypeDto[];
  entries: ScheduleEntryDto[];
  dailyCoverage: DailyCoverageItemDto[];
  warnings: Array<{
    code: string;
    workDate?: string;
    shiftTypeId?: number;
    message: string;
  }>;
}

export interface StaffScheduleDayDto {
  workDate: string;
  weekday: number;
  shift: {
    code: string;
    name: string;
    startTime: string | null;
    durationMinutes: number | null;
    color: string;
  } | null;
  note: string | null;
}

export interface StaffScheduleDto {
  weekStart: string;
  publishedAt: string | null;
  version: number | null;
  status?: 'not_published';
  days: StaffScheduleDayDto[];
}

/** 计算 date 所在周的周一（Asia/Shanghai 日历日） */
export function weekStartFromDate(date: Date): string {
  const shanghai = dayjs(date).utcOffset(8);
  const day = shanghai.day();
  const diff = day === 0 ? -6 : 1 - day;
  return shanghai.add(diff, 'day').format('YYYY-MM-DD');
}

export function isMonday(dateStr: string): boolean {
  return dayjs(dateStr).day() === 1;
}
