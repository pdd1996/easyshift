import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from './api';

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const loginMutation = useMutation({
    mutationFn: (values: { phone: string; password: string }) =>
      loginAdmin(values.phone, values.password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'me'] });
      message.success('登录成功');
      navigate('/');
    },
    onError: () => {
      message.error('账号或密码错误');
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <Typography.Title level={3} className="!mb-1">
          EasyShift 易排班
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-6">
          科室排班管理端
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ phone: '13800000000' }}
          onFinish={(values) => loginMutation.mutate(values)}
        >
          <Form.Item
            label="手机号"
            name="phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="管理员手机号" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="登录密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
