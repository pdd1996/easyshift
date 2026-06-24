import { Layout, Menu, Typography, Button } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutAdmin, useAdminSession } from '@/features/auth/api';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: session } = useAdminSession();

  const selectedKey =
    location.pathname === '/employees'
      ? 'employees'
      : location.pathname.startsWith('/schedule')
        ? 'schedule'
        : location.pathname.startsWith('/shift-types')
          ? 'shifts'
          : 'dashboard';

  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: async () => {
      await queryClient.resetQueries({ queryKey: ['admin', 'me'] });
      navigate('/login');
    },
  });

  return (
    <Layout className="min-h-screen">
      <Sider theme="light" width={220} className="border-r border-gray-200">
        <div className="px-4 py-5">
          <Typography.Title level={5} className="!mb-0">
            EasyShift
          </Typography.Title>
          <Typography.Text type="secondary">{session?.department.name}</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            if (key === 'dashboard') navigate('/');
            if (key === 'employees') navigate('/employees');
            if (key === 'shifts') navigate('/shift-types');
          }}
          items={[
            { key: 'dashboard', label: '工作台' },
            { key: 'employees', label: '员工管理' },
            { key: 'shifts', label: '班次类型' },
            { key: 'schedule', label: '排班表', disabled: true },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between bg-white px-6">
          <Typography.Text>{session?.user.phone}</Typography.Text>
          <Button onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
            退出登录
          </Button>
        </Header>
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
