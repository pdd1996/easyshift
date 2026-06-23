import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useAdminSession } from '@/features/auth/api';

export function DashboardPage() {
  const { data: session } = useAdminSession();

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!mb-1">
          工作台
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Web + API 脚手架已就绪，后续将在此接入排班表与员工管理。
        </Typography.Paragraph>
      </div>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="当前科室" value={session?.department.name ?? '-'} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="管理员" value={session?.user.phone ?? '-'} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="开发阶段" value="Scaffold" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
