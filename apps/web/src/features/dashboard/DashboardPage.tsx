import { weekStartFromDate } from '@easyshift/shared-types';
import { Card, Col, Row, Spin, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminSession } from '@/features/auth/api';
import { type PeriodDto, useSchedulePeriods } from '@/features/schedule/api';
import { formatWeekRange } from '@/features/schedule/utils';

function getWeekScheduleStatus(period: PeriodDto | null | undefined): {
  label: string;
  color: string;
} {
  if (!period) {
    return { label: '尚未创建', color: 'default' };
  }
  if (period.editStatus === 'draft') {
    return { label: '草稿', color: 'blue' };
  }
  if (period.hasUnpublishedChanges) {
    return { label: '有未发布变更', color: 'orange' };
  }
  return { label: '已发布', color: 'green' };
}

function getWeekScheduleStatusTag(
  period: PeriodDto | null | undefined,
  isError: boolean,
): { label: string; color: string } {
  if (isError) {
    return { label: '加载失败', color: 'red' };
  }
  return getWeekScheduleStatus(period);
}

const QUICK_ENTRIES = [
  {
    key: 'schedule',
    title: '排班表',
    description: '编辑与发布本周排班',
    path: (weekStart: string) => `/schedule?weekStart=${weekStart}`,
  },
  {
    key: 'change-logs',
    title: '操作记录',
    description: '查看排班变更历史',
    path: () => '/change-logs',
  },
  {
    key: 'employees',
    title: '员工管理',
    description: '维护员工与绑定码',
    path: () => '/employees',
  },
  {
    key: 'shift-types',
    title: '班次类型',
    description: '配置班次与颜色',
    path: () => '/shift-types',
  },
  {
    key: 'department',
    title: '科室设置',
    description: '科室信息与参数',
    path: () => '/department',
  },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: session } = useAdminSession();
  const currentWeekStart = useMemo(() => weekStartFromDate(new Date()), []);

  const {
    data: periods,
    isError: periodsIsError,
    isLoading: periodsLoading,
  } = useSchedulePeriods({
    fromWeekStart: currentWeekStart,
    toWeekStart: currentWeekStart,
  });

  const currentPeriod = periods?.find((period) => period.weekStart === currentWeekStart) ?? null;
  const weekStatus = getWeekScheduleStatusTag(currentPeriod, periodsIsError);
  const weekRangeLabel = formatWeekRange(currentWeekStart);

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!mb-1">
          工作台
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0">
          {session?.department.name ?? '当前科室'} · {weekRangeLabel}
        </Typography.Paragraph>
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">当前科室</Typography.Text>
            <Typography.Title level={4} className="!mb-0 !mt-1">
              {session?.department.name ?? '-'}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">管理员</Typography.Text>
            <Typography.Title level={4} className="!mb-0 !mt-1">
              {session?.user.phone ?? '-'}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            className="cursor-pointer"
            onClick={() => navigate(`/schedule?weekStart=${currentWeekStart}`)}
          >
            <Typography.Text type="secondary">本周排班状态</Typography.Text>
            <Spin spinning={periodsLoading}>
              <div className="mt-1">
                <Tag color={weekStatus.color}>{weekStatus.label}</Tag>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      <div>
        <Typography.Title level={5} className="!mb-3">
          快捷入口
        </Typography.Title>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_ENTRIES.map((entry) => (
            <Card
              key={entry.key}
              hoverable
              className="cursor-pointer"
              onClick={() => navigate(entry.path(currentWeekStart))}
            >
              <Typography.Text strong>{entry.title}</Typography.Text>
              <Typography.Paragraph type="secondary" className="!mb-0 !mt-1 text-sm">
                {entry.description}
              </Typography.Paragraph>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
