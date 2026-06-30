import type {
  EmployeeDto,
  ScheduleChangeLogAction,
  ScheduleChangeLogDto,
  ShiftTypeDto,
} from '@easyshift/shared-types';

const ACTION_LABELS: Record<ScheduleChangeLogAction, string> = {
  period_create: '创建周期',
  entry_upsert: '保存排班',
  entry_delete: '清除排班',
  copy_from_week: '复制上周',
  publish: '发布排班',
};

function employeeName(employees: EmployeeDto[], employeeId: number): string {
  return employees.find((employee) => employee.id === employeeId)?.name ?? `员工#${employeeId}`;
}

function shiftLabel(shiftTypes: ShiftTypeDto[], shiftTypeId: number): string {
  const shiftType = shiftTypes.find((item) => item.id === shiftTypeId);
  return shiftType ? `${shiftType.code} ${shiftType.name}` : `班次#${shiftTypeId}`;
}

function formatEntryUpsertDetail(
  detail: Record<string, unknown> | null,
  employees: EmployeeDto[],
  shiftTypes: ShiftTypeDto[],
): string {
  const entries = detail?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return '无明细';
  }

  if (entries.length === 1) {
    const entry = entries[0] as {
      employeeId?: number;
      workDate?: string;
      shiftTypeId?: number;
    };
    if (entry.employeeId != null && entry.workDate && entry.shiftTypeId != null) {
      return `${employeeName(employees, entry.employeeId)} · ${entry.workDate} → ${shiftLabel(shiftTypes, entry.shiftTypeId)}`;
    }
  }

  if (entries.length <= 3) {
    return entries
      .map((item) => {
        const entry = item as { employeeId?: number; workDate?: string; shiftTypeId?: number };
        if (entry.employeeId == null || !entry.workDate || entry.shiftTypeId == null) {
          return null;
        }
        return `${employeeName(employees, entry.employeeId)} · ${entry.workDate} → ${shiftLabel(shiftTypes, entry.shiftTypeId)}`;
      })
      .filter((line): line is string => line != null)
      .join('；');
  }

  return `共 ${entries.length} 格`;
}

function formatEntryDeleteDetail(
  detail: Record<string, unknown> | null,
  employees: EmployeeDto[],
): string {
  const employeeId = detail?.employeeId;
  const workDate = detail?.workDate;
  if (typeof employeeId !== 'number' || typeof workDate !== 'string') {
    return '无明细';
  }
  return `${employeeName(employees, employeeId)} · ${workDate}`;
}

function formatCopyDetail(detail: Record<string, unknown> | null): string {
  const sourceWeekStart = detail?.sourceWeekStart;
  const copiedCount = detail?.copiedCount;
  const skippedCount = detail?.skippedCount;
  if (typeof sourceWeekStart !== 'string') {
    return '无明细';
  }
  const copied = typeof copiedCount === 'number' ? copiedCount : 0;
  const skipped = typeof skippedCount === 'number' ? skippedCount : 0;
  return `从 ${sourceWeekStart} 复制 ${copied} 格，跳过 ${skipped} 格`;
}

function formatPublishDetail(detail: Record<string, unknown> | null): string {
  const version = detail?.version;
  return typeof version === 'number' ? `版本 v${version}` : '无明细';
}

export function getChangeLogActionLabel(action: ScheduleChangeLogAction): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatChangeLogSummary(
  log: ScheduleChangeLogDto,
  employees: EmployeeDto[],
  shiftTypes: ShiftTypeDto[],
): string {
  switch (log.action) {
    case 'entry_upsert':
      return formatEntryUpsertDetail(log.detail, employees, shiftTypes);
    case 'entry_delete':
      return formatEntryDeleteDetail(log.detail, employees);
    case 'copy_from_week':
      return formatCopyDetail(log.detail);
    case 'publish':
      return formatPublishDetail(log.detail);
    case 'period_create':
      return '新建排班周期';
    default:
      return '无明细';
  }
}

export function formatOperatorLabel(phone: string | null): string {
  return phone ?? '未知操作人';
}
