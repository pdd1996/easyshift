import type { ScheduleChangeLogDto } from '@easyshift/shared-types';
import { Button, DatePicker, Drawer, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
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

const { RangePicker } = DatePicker;

function getDefaultDateRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(6, 'day'), dayjs()];
}

function toDateRangeParams(range: [Dayjs, Dayjs] | null): { from?: string; to?: string } {
  if (!range?.[0] || !range?.[1]) {
    return {};
  }
  return {
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
  };
}

export function ChangeLogsPage() {
  const navigate = useNavigate();
  const [dateRangeInput, setDateRangeInput] = useState<[Dayjs, Dayjs] | null>(() =>
    getDefaultDateRange(),
  );
  const [dateRangeApplied, setDateRangeApplied] = useState<{ from?: string; to?: string }>(() =>
    toDateRangeParams(getDefaultDateRange()),
  );
  const [actionInput, setActionInput] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<ScheduleChangeLogDto | null>(null);

  const { data: filterOptions } = useChangeLogFilterOptions();
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 100 });
  const { data: shiftTypes = [] } = useShiftTypes();

  const { data, isLoading } = useChangeLogs({
    page,
    pageSize,
    ...dateRangeApplied,
    action,
  });

  const employees = employeesData?.data ?? [];

  const resetPage = () => setPage(1);

  const handleSearch = () => {
    setDateRangeApplied(toDateRangeParams(dateRangeInput));
    setAction(actionInput);
    resetPage();
  };

  const handleReset = () => {
    const defaultRange = getDefaultDateRange();
    setDateRangeInput(defaultRange);
    setDateRangeApplied(toDateRangeParams(defaultRange));
    setActionInput(undefined);
    setAction(undefined);
    resetPage();
  };

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

  return (
    <div>
      <Typography.Title level={4} className="!mb-4">
        操作记录
      </Typography.Title>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangePicker
          allowClear
          value={dateRangeInput}
          onChange={(dates) => setDateRangeInput(dates as [Dayjs, Dayjs] | null)}
          placeholder={['开始日期', '结束日期']}
        />
        <Select
          allowClear
          placeholder="操作类型"
          style={{ minWidth: 140 }}
          value={actionInput}
          options={filterOptions?.actions.map((item) => ({
            value: item,
            label: getChangeLogActionLabel(item),
          }))}
          onChange={setActionInput}
        />
        <Space className="ml-auto">
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </div>

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
