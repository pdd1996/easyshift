import type { DailyCoverageItemDto, ScheduleEntryDto, ShiftTypeKind } from '@easyshift/shared-types';

export interface SnapshotShiftType {
  id: number;
  code: string;
  name: string;
  kind: ShiftTypeKind;
  startTime: string | null;
  durationMinutes: number | null;
  color: string;
  minRequiredCount: number;
}

export interface SnapshotEmployee {
  id: number;
  employeeNo: string;
  name: string;
  title: string | null;
}

export interface SnapshotData {
  meta: {
    departmentId: number;
    departmentName: string;
    weekStart: string;
    version: number;
    publishedAt: string;
  };
  shiftTypes: SnapshotShiftType[];
  employees: SnapshotEmployee[];
  entries: ScheduleEntryDto[];
  dailyCoverage: DailyCoverageItemDto[];
}
