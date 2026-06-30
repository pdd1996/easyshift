import type { ScheduleChangeLogDto } from '@easyshift/shared-types';
import { Button, Drawer, Segmented, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployees } from '@/features/employees/api';
import { formatWeekRange } from '@/features/schedule/utils';
import { useShiftTypes } from '@/features/shift-types/api';
import { useChangeLogFilterOptions, useChangeLogs } from './api';
import {
  formatChangeLogSummary,
  formatOperatorLabel,
  getChangeLogActionLabel,
} from './change-log-utils';

type TimeRangePreset = '7d' | '30d' | 'all';

function computeDateRange(preset: TimeRangePreset): { from?: string; to?: string } {
  if (preset === 'all') {
    return {};
  }
  const to = dayjs().format('YYYY-MM-DD');
  const days = preset === '7d' ? 6 : 29;
  const from = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
  return { from, to };
}

export function ChangeLogsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('7d');
  const [periodId, setPeriodId] = useState<number | undefined>(undefined);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [operatorId, setOperatorId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<ScheduleChangeLogDto | null>(null);

  const dateRange = useMemo(() => computeDateRange(timeRange), [timeRange]);

  const { data: filterOptions } = useChangeLogFilterOptions();
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 100 });
  const { data: shiftTypes = [] } = useShiftTypes();

  const { data, isLoading } = useChangeLogs({
    page,
    pageSize,
    ...dateRange,
    periodId,
    action,
    operatorId,
  });

  const employees = employeesData?.data ?? [];

  const columns: ColumnsType<ScheduleChangeLogDto> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (value: ScheduleChangeLogDto['action']) => getChangeLogActionLabel(value),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 130,
      render: (operator: ScheduleChangeLogDto['operator']) => formatOperatorLabel(operator.phone),
    },
    {
      title: '排班周',
      dataIndex: 'weekStart',
      width: 140,
      render: (weekStart: string) => formatWeekRange(weekStart),
    },
    {
      title: '摘要',
      key: 'summary',
      render: (_, record) => formatChangeLogSummary(record, employees, shiftTypes),
    },
  ];

  const resetPage = () => setPage(1);

  return (
    <div>
      <Typography.Title level={4} className="!mb-4">
        操作记录
      </Typography.Title>

      <Space wrap className="mb-4">
        <Segmented
          value={timeRange}
          options={[
            { label: '最近 7 天', value: '7d' },
            { label: '最近 30 天', value: '30d' },
            { label: '不限', value: 'all' },
          ]}
          onChange={(value) => {
            setTimeRange(value as TimeRangePreset);
            resetPage();
          }}
        />
        <Select
          allowClear
          placeholder="排班周"
          style={{ minWidth: 180 }}
          value={periodId}
          options={filterOptions?.periods.map((period) => ({
            value: period.id,
            label: formatWeekRange(period.weekStart),
          }))}
          onChange={(value) => {
            setPeriodId(value);
            resetPage();
          }}
        />
        <Select
          allowClear
          placeholder="操作类型"
          style={{ minWidth: 140 }}
          value={action}
          options={filterOptions?.actions.map((item) => ({
            value: item,
            label: getChangeLogActionLabel(item),
          }))}
          onChange={(value) => {
            setAction(value);
            resetPage();
          }}
        />
        <Select
          allowClear
          placeholder="操作人"
          style={{ minWidth: 140 }}
          value={operatorId}
          options={filterOptions?.operators.map((operator) => ({
            value: operator.id,
            label: formatOperatorLabel(operator.phone),
          }))}
          onChange={(value) => {
            setOperatorId(value);
            resetPage();
          }}
        />
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={isLoading}
        columns={columns}
        dataSource={data?.data ?? []}
        onRow={(record) => ({
          onClick: () => setSelectedLog(record),
          className: 'cursor-pointer',
        })}
        pagination={{
          current: page,
          pageSize,
          total: data?.meta.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <Drawer
        title="操作详情"
        open={selectedLog != null}
        onClose={() => setSelectedLog(null)}
        width={560}
        destroyOnClose
        extra={
          selectedLog ? (
            <Button
              type="link"
              onClick={() => {
                navigate(`/schedule?weekStart=${selectedLog.weekStart}`);
                setSelectedLog(null);
              }}
            >
              查看该周排班
            </Button>
          ) : null
        }
      >
        {selectedLog && (
          <Space direction="vertical" size="middle" className="w-full">
            <div>
              <Typography.Text type="secondary">时间</Typography.Text>
              <div>{dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}</div>
            </div>
            <div>
              <Typography.Text type="secondary">操作</Typography.Text>
              <div>{getChangeLogActionLabel(selectedLog.action)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">操作人</Typography.Text>
              <div>{formatOperatorLabel(selectedLog.operator.phone)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">排班周</Typography.Text>
              <div>{formatWeekRange(selectedLog.weekStart)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">摘要</Typography.Text>
              <div>{formatChangeLogSummary(selectedLog, employees, shiftTypes)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">明细</Typography.Text>
              <pre className="mt-1 overflow-auto rounded bg-gray-50 p-3 text-xs">
                {JSON.stringify(selectedLog.detail, null, 2)}
              </pre>
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
