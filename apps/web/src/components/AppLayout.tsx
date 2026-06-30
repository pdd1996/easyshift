import { useState } from 'react';
import { Layout, Menu, Typography, Button } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutAdmin, useAdminSession } from '@/features/auth/api';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: session } = useAdminSession();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey =
    location.pathname === '/employees'
      ? 'employees'
      : location.pathname.startsWith('/change-logs')
        ? 'change-logs'
        : location.pathname.startsWith('/schedule')
          ? 'schedule'
          : location.pathname.startsWith('/shift-types')
            ? 'shifts'
            : location.pathname.startsWith('/department')
              ? 'department'
              : 'dashboard';

  const logoutMutation = useMutation({
    mutationFn: logoutAdmin,
    onSuccess: async () => {
      await queryClient.resetQueries({ queryKey: ['admin', 'me'] });
      navigate('/login');
    },
  });

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        theme="light"
        width={220}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        className="!bg-white border-r border-gray-200"
        style={{ height: '100vh', overflow: 'auto' }}
      >
        <div
          className={`flex items-center border-b border-gray-100 px-3 py-4 ${
            collapsed ? 'justify-center' : 'justify-between gap-2'
          }`}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <Typography.Title level={5} className="!mb-0">
                EasyShift
              </Typography.Title>
              <Typography.Text type="secondary" className="text-xs">
                {session?.department.name}
              </Typography.Text>
            </div>
          )}
          <Button
            type="text"
            size="small"
            aria-label={collapsed ? '展开导航' : '收起导航'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
          />
        </div>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            if (key === 'dashboard') navigate('/');
            if (key === 'employees') navigate('/employees');
            if (key === 'shifts') navigate('/shift-types');
            if (key === 'schedule') navigate('/schedule');
            if (key === 'change-logs') navigate('/change-logs');
            if (key === 'department') navigate('/department');
          }}
          items={[
            { key: 'dashboard', icon: <AppstoreOutlined />, label: '工作台' },
            { key: 'schedule', icon: <CalendarOutlined />, label: '排班表' },
            { key: 'change-logs', icon: <HistoryOutlined />, label: '操作记录' },
            { key: 'employees', icon: <TeamOutlined />, label: '员工管理' },
            { key: 'shifts', icon: <TagsOutlined />, label: '班次类型' },
            { key: 'department', icon: <SettingOutlined />, label: '科室设置' },
          ]}
        />
      </Sider>
      <Layout className="flex min-h-0 flex-1 flex-col">
        <Header className="!flex !h-14 !items-center !justify-between !bg-white !px-6 !py-0 !leading-normal border-b border-gray-200">
          <Typography.Text type="secondary">管理员 · {session?.user.phone}</Typography.Text>
          <Button type="link" onClick={() => logoutMutation.mutate()} loading={logoutMutation.isPending}>
            退出登录
          </Button>
        </Header>
        <Content className="min-h-0 flex-1 overflow-auto bg-[#F8FAFC] p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
