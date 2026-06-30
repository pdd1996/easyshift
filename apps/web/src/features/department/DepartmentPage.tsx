import { App, Button, Card, Form, Input, Spin, Typography, message } from 'antd';
import { useEffect } from 'react';
import { getApiErrorMessage, useDepartment, useUpdateDepartment } from './api';

interface DepartmentFormValues {
  name: string;
}

export function DepartmentPage() {
  const { modal } = App.useApp();
  const [form] = Form.useForm<DepartmentFormValues>();
  const { data: department, isLoading } = useDepartment();
  const updateMutation = useUpdateDepartment();

  useEffect(() => {
    if (department) {
      form.setFieldsValue({ name: department.name });
    }
  }, [department, form]);

  const handleSubmit = async (values: DepartmentFormValues) => {
    if (department && values.name.trim() === department.name) {
      message.info('科室名称未变更');
      return;
    }

    try {
      await updateMutation.mutateAsync(values.name.trim());
      message.success('科室名称已更新');
    } catch (error) {
      message.error(getApiErrorMessage(error, '保存失败'));
    }
  };

  const handleReset = () => {
    if (department) {
      form.setFieldsValue({ name: department.name });
    }
  };

  const hasUnsavedChanges = () => {
    if (!department) {
      return false;
    }
    return form.getFieldValue('name')?.trim() !== department.name;
  };

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!mb-1">
          科室设置
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          v1 为单科室模式，可在此修改当前科室名称；侧边栏与工作台将同步显示。
        </Typography.Paragraph>
      </div>

      <Card className="max-w-xl">
        <Spin spinning={isLoading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            disabled={isLoading || !department}
          >
            <Form.Item
              label="科室名称"
              name="name"
              rules={[
                { required: true, message: '请输入科室名称' },
                { max: 100, message: '科室名称不能超过 100 个字符' },
                { whitespace: true, message: '科室名称不能为空格' },
              ]}
            >
              <Input placeholder="例如：心内科一病区" maxLength={100} />
            </Form.Item>
            <Form.Item className="!mb-0">
              <div className="flex gap-2">
                <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                  保存
                </Button>
                <Button
                  onClick={() => {
                    if (hasUnsavedChanges()) {
                      modal.confirm({
                        title: '放弃未保存的修改？',
                        onOk: handleReset,
                      });
                      return;
                    }
                    handleReset();
                  }}
                >
                  重置
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
}
