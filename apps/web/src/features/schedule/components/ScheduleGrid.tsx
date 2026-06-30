import type { EmployeeDto, ScheduleEntryDto, ShiftTypeDto } from '@easyshift/shared-types';
import { Button, Popover, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { buildEntryMap, entryKey, getWeekDates } from '../utils';
import { ScheduleDateHeader } from './ScheduleDateHeader';

interface ScheduleGridProps {
  weekStart: string;
  employees: EmployeeDto[];
  shiftTypes: ShiftTypeDto[];
  entries: ScheduleEntryDto[];
  onAssignShift: (employeeId: number, workDate: string, shiftTypeId: number) => void;
  onClearShift: (employeeId: number, workDate: string) => void;
  isSaving: boolean;
}

export function ScheduleGrid({
  weekStart,
  employees,
  shiftTypes,
  entries,
  onAssignShift,
  onClearShift,
  isSaving,
}: ScheduleGridProps) {
  const weekDates = getWeekDates(weekStart);
  const entryMap = useMemo(() => buildEntryMap(entries), [entries]);
  const shiftTypeById = useMemo(
    () => new Map(shiftTypes.map((st) => [st.id, st])),
    [shiftTypes],
  );
  const selectableShiftTypes = useMemo(
    () => shiftTypes.filter((st) => st.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder),
    [shiftTypes],
  );

  const [openCell, setOpenCell] = useState<string | null>(null);

  const renderCellContent = (employeeId: number, workDate: string) => {
    const entry = entryMap.get(entryKey(employeeId, workDate));
    if (!entry) {
      return <span className="text-gray-300">—</span>;
    }

    const shiftType = shiftTypeById.get(entry.shiftTypeId);
    if (!shiftType) {
      return <span className="text-gray-400">?</span>;
    }

    return (
      <span
        className="inline-flex min-w-8 items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: shiftType.color }}
      >
        {shiftType.code}
      </span>
    );
  };

  const renderPicker = (employee: EmployeeDto, workDate: string) => {
    const employeeId = employee.id;
    const entry = entryMap.get(entryKey(employeeId, workDate));
    const canAssign = employee.status === 'active';

    return (
      <div className="w-44 space-y-2">
        {canAssign ? (
          selectableShiftTypes.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {selectableShiftTypes.map((shiftType) => (
                <Button
                  key={shiftType.id}
                  size="small"
                  disabled={isSaving}
                  className="!px-1"
                  style={{
                    borderColor: shiftType.color,
                    color: entry?.shiftTypeId === shiftType.id ? '#fff' : shiftType.color,
                    backgroundColor:
                      entry?.shiftTypeId === shiftType.id ? shiftType.color : 'transparent',
                  }}
                  onClick={() => {
                    onAssignShift(employeeId, workDate, shiftType.id);
                    setOpenCell(null);
                  }}
                >
                  {shiftType.code}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">暂无可用班次</div>
          )
        ) : (
          <div className="text-xs text-gray-500">停用员工仅可清空历史排班</div>
        )}
        {entry && (
          <Button
            size="small"
            danger
            block
            disabled={isSaving}
            onClick={() => {
              onClearShift(employeeId, workDate);
              setOpenCell(null);
            }}
          >
            清空
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="sticky left-0 top-0 z-30 w-36 min-w-36 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
              员工
            </th>
            {weekDates.map((workDate) => (
              <ScheduleDateHeader key={workDate} workDate={workDate} />
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2">
                <div className="font-medium">{employee.name}</div>
                {employee.status === 'inactive' && (
                  <Tag className="!mt-0.5" color="default">
                    停用
                  </Tag>
                )}
              </td>
              {weekDates.map((workDate) => {
                const cellId = entryKey(employee.id, workDate);
                const entry = entryMap.get(cellId);
                const canOpenPicker = employee.status === 'active' || entry != null;

                const cellButton = (
                  <button
                    type="button"
                    className={`flex h-8 w-full items-center justify-center rounded ${
                      canOpenPicker ? 'hover:bg-blue-50' : 'cursor-not-allowed opacity-50'
                    }`}
                    disabled={isSaving || !canOpenPicker}
                    title={!canOpenPicker ? '停用员工不可新排班' : undefined}
                  >
                    {renderCellContent(employee.id, workDate)}
                  </button>
                );

                return (
                  <td
                    key={workDate}
                    className="border-r border-gray-100 px-2 py-2 text-center last:border-r-0"
                  >
                    {canOpenPicker ? (
                      <Popover
                        content={renderPicker(employee, workDate)}
                        title="选择班次"
                        trigger="click"
                        open={openCell === cellId}
                        onOpenChange={(open) => setOpenCell(open ? cellId : null)}
                      >
                        {cellButton}
                      </Popover>
                    ) : (
                      cellButton
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
