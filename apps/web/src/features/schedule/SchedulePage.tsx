import { weekStartFromDate } from '@easyshift/shared-types';
import { Alert, App, Button, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getApiErrorMessage,
  useCreatePeriod,
  useDeleteEntry,
  useScheduleGrid,
  useSchedulePeriods,
  useUpsertEntries,
} from './api';
import { DailyCoverageRow } from './components/DailyCoverageRow';
import { ScheduleGrid } from './components/ScheduleGrid';
import { addWeeks, formatWeekRange } from './utils';

function PeriodStatusTags({
  editStatus,
  hasUnpublishedChanges,
}: {
  editStatus: 'draft' | 'published';
  hasUnpublishedChanges: boolean;
}) {
  if (editStatus === 'draft') {
    return <Tag color="blue">草稿</Tag>;
  }
  if (hasUnpublishedChanges) {
    return <Tag color="orange">有未发布变更</Tag>;
  }
  return <Tag color="green">已发布</Tag>;
}

export function SchedulePage() {
  const { modal } = App.useApp();
  const [weekStart, setWeekStart] = useState(() => weekStartFromDate(new Date()));
  const [publishedEditConfirmed, setPublishedEditConfirmed] = useState(false);
  const [warningsVisible, setWarningsVisible] = useState(false);

  const {
    data: periods,
    isLoading: periodsLoading,
    isError: periodsIsError,
    refetch: refetchPeriods,
  } = useSchedulePeriods({
    fromWeekStart: weekStart,
    toWeekStart: weekStart,
  });

  const currentPeriod = periods?.find((p) => p.weekStart === weekStart) ?? null;

  const {
    data: grid,
    isLoading: gridLoading,
    isError: gridIsError,
    refetch: refetchGrid,
  } = useScheduleGrid(currentPeriod?.id ?? null);

  const createPeriodMutation = useCreatePeriod();
  const upsertMutation = useUpsertEntries(currentPeriod?.id ?? 0);
  const deleteMutation = useDeleteEntry(currentPeriod?.id ?? 0);

  useEffect(() => {
    setPublishedEditConfirmed(false);
    setWarningsVisible(false);
  }, [currentPeriod?.id]);

  const activeShiftTypes = useMemo(
    () =>
      (grid?.shiftTypes ?? [])
        .filter((st) => st.status === 'active')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [grid?.shiftTypes],
  );

  const ensureCanEdit = useCallback((): Promise<boolean> => {
    if (!grid?.period) {
      return Promise.resolve(false);
    }
    if (grid.period.editStatus === 'draft' || publishedEditConfirmed) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      modal.confirm({
        title: '编辑已发布排班',
        content:
          '该周期已发布。继续编辑将标记为「有未发布变更」，员工端仍读取上一版发布快照，直到再次发布。',
        okText: '继续编辑',
        cancelText: '取消',
        onOk: () => {
          setPublishedEditConfirmed(true);
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });
  }, [grid?.period, modal, publishedEditConfirmed]);

  const handleCreatePeriod = async () => {
    try {
      await createPeriodMutation.mutateAsync(weekStart);
      message.success('排班周期已创建');
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleAssignShift = async (
    employeeId: number,
    workDate: string,
    shiftTypeId: number,
  ) => {
    if (!currentPeriod) {
      return;
    }

    const allowed = await ensureCanEdit();
    if (!allowed) {
      return;
    }

    try {
      await upsertMutation.mutateAsync([{ employeeId, workDate, shiftTypeId }]);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleClearShift = async (employeeId: number, workDate: string) => {
    if (!currentPeriod) {
      return;
    }

    const allowed = await ensureCanEdit();
    if (!allowed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ employeeId, workDate });
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleCheckWarnings = () => {
    if (!grid) {
      return;
    }

    if (grid.warnings.length === 0) {
      message.success('当前没有覆盖不足警告');
      return;
    }

    setWarningsVisible(true);
  };

  const isSaving = upsertMutation.isPending || deleteMutation.isPending;
  const isLoading = periodsLoading || (currentPeriod != null && gridLoading);
  const isCurrentWeek = weekStart === weekStartFromDate(new Date());
  const isNextWeek = weekStart === addWeeks(weekStartFromDate(new Date()), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography.Title level={3} className="!mb-1">
            排班表
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            周视图排班，点击单元格选择或清空班次
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Button onClick={() => setWeekStart((prev) => addWeeks(prev, -1))}>上一周</Button>
          <Button
            onClick={() => setWeekStart(weekStartFromDate(new Date()))}
            type={isCurrentWeek ? 'primary' : 'default'}
          >
            本周
          </Button>
          <Button onClick={() => setWeekStart((prev) => addWeeks(prev, 1))}>下一周</Button>
        </Space>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <Space wrap>
          <Typography.Text strong>{formatWeekRange(weekStart)}</Typography.Text>
          {grid?.period && (
            <PeriodStatusTags
              editStatus={grid.period.editStatus}
              hasUnpublishedChanges={grid.period.hasUnpublishedChanges}
            />
          )}
          {!currentPeriod && !periodsLoading && !periodsIsError && (
            <Tag color="default">尚未创建</Tag>
          )}
        </Space>

        {grid && (
          <Button onClick={handleCheckWarnings}>
            检查覆盖{grid.warnings.length > 0 ? `（${grid.warnings.length}）` : ''}
          </Button>
        )}

        {!currentPeriod && !periodsIsError && (
          <Button
            type="primary"
            loading={createPeriodMutation.isPending}
            onClick={handleCreatePeriod}
          >
            {isCurrentWeek ? '创建本周排班' : isNextWeek ? '创建下周排班' : '创建排班周期'}
          </Button>
        )}
      </div>

      {warningsVisible && grid?.warnings && grid.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="覆盖不足"
          description={
            <ul className="mb-0 list-inside list-disc">
              {grid.warnings.map((w, i) => (
                <li key={`${w.code}-${w.workDate}-${w.shiftTypeId}-${i}`}>{w.message}</li>
              ))}
            </ul>
          }
        />
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spin size="large" />
          </div>
        ) : periodsIsError ? (
          <div className="p-6">
            <Alert
              type="error"
              showIcon
              message="排班周期加载失败"
              description="请稍后重试，或检查 API 服务是否正常。"
              action={<Button onClick={() => refetchPeriods()}>重试</Button>}
            />
          </div>
        ) : !currentPeriod ? (
          <Empty
            className="py-16"
            description={
              <span>
                {formatWeekRange(weekStart)} 尚无排班周期
                <br />
                <Typography.Text type="secondary">
                  点击上方按钮创建后开始排班
                </Typography.Text>
              </span>
            }
          />
        ) : gridIsError ? (
          <div className="p-6">
            <Alert
              type="error"
              showIcon
              message="排班表加载失败"
              description="请稍后重试，或检查当前排班周期数据是否正常。"
              action={<Button onClick={() => refetchGrid()}>重试</Button>}
            />
          </div>
        ) : grid ? (
          <>
            <ScheduleGrid
              weekStart={weekStart}
              employees={grid.employees}
              shiftTypes={grid.shiftTypes}
              entries={grid.entries}
              onAssignShift={handleAssignShift}
              onClearShift={handleClearShift}
              isSaving={isSaving}
            />
            <DailyCoverageRow
              weekStart={weekStart}
              dailyCoverage={grid.dailyCoverage}
              activeShiftTypes={activeShiftTypes}
            />
          </>
        ) : null}
      </div>

      {currentPeriod && grid && grid.employees.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="暂无员工"
          description="请先在「员工管理」中添加在职员工后再排班。"
        />
      )}

      {currentPeriod && grid && activeShiftTypes.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="暂无班次类型"
          description="请先在「班次类型」中配置启用中的班次后再排班。"
        />
      )}
    </div>
  );
}
