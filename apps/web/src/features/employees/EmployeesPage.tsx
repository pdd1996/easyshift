import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { EmployeeDto } from '@easyshift/shared-types';
import dayjs from 'dayjs';
import { useState, type KeyboardEvent } from 'react';
import {
  getApiErrorMessage,
  useCreateEmployee,
  useDeactivateEmployee,
  useEmployees,
  useGenerateBindingCode,
  useUpdateEmployee,
  type EmployeeFormValues,
} from './api';

type FormMode = 'create' | 'edit';

export function EmployeesPage() {
  const { modal } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilterInput, setStatusFilterInput] = useState<'active' | 'inactive' | undefined>(
    undefined,
  );
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined);
  const [bindingStatusFilterInput, setBindingStatusFilterInput] = useState<
    'bound' | 'unbound' | undefined
  >(undefined);
  const [bindingStatusFilter, setBindingStatusFilter] = useState<'bound' | 'unbound' | undefined>(
    undefined,
  );
  const [employeeNoInput, setEmployeeNoInput] = useState('');
  const [employeeNo, setEmployeeNo] = useState<string | undefined>(undefined);
  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState<string | undefined>(undefined);
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [titleInput, setTitleInput] = useState('');
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDto | null>(null);
  const [bindingCode, setBindingCode] = useState<{ code: string; expiresAt: string } | null>(null);

  const [form] = Form.useForm<EmployeeFormValues>();

  const { data, isLoading } = useEmployees({
    status: statusFilter,
    employeeNo,
    name,
    phone,
    title,
    bindingStatus: bindingStatusFilter,
    page,
    pageSize,
  });
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deactivateMutation = useDeactivateEmployee();
  const bindingCodeMutation = useGenerateBindingCode();

  const openCreate = () => {
    setFormMode('create');
    setEditingEmployee(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (employee: EmployeeDto) => {
    setFormMode('edit');
    setEditingEmployee(employee);
    form.setFieldsValue({
      employeeNo: employee.employeeNo,
      name: employee.name,
      title: employee.title ?? undefined,
      phone: employee.phone,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: EmployeeFormValues) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(values);
        message.success('员工已新增');
      } else if (editingEmployee) {
        await updateMutation.mutateAsync({ id: editingEmployee.id, ...values });
        message.success('员工信息已更新');
      }
      setFormOpen(false);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleDeactivate = (employee: EmployeeDto) => {
    modal.confirm({
      title: '确认停用员工？',
      content: `停用后「${employee.name}」将不可参与新排班，历史数据保留。`,
      okText: '停用',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deactivateMutation.mutateAsync(employee.id);
          message.success('员工已停用');
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const handleGenerateBindingCode = async (employee: EmployeeDto) => {
    try {
      const result = await bindingCodeMutation.mutateAsync(employee.id);
      setBindingCode({ code: result.bindingCode, expiresAt: result.expiresAt });
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const resetPage = () => setPage(1);

  const normalizeTextFilter = (value: string) => {
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  const handleSearch = () => {
    setEmployeeNo(normalizeTextFilter(employeeNoInput));
    setName(normalizeTextFilter(nameInput));
    setPhone(normalizeTextFilter(phoneInput));
    setTitle(normalizeTextFilter(titleInput));
    setStatusFilter(statusFilterInput);
    setBindingStatusFilter(bindingStatusFilterInput);
    resetPage();
  };

  const handleReset = () => {
    setEmployeeNoInput('');
    setNameInput('');
    setPhoneInput('');
    setTitleInput('');
    setStatusFilterInput(undefined);
    setBindingStatusFilterInput(undefined);
    setEmployeeNo(undefined);
    setName(undefined);
    setPhone(undefined);
    setTitle(undefined);
    setStatusFilter(undefined);
    setBindingStatusFilter(undefined);
    resetPage();
  };

  const handleFilterKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSearch();
    }
  };

  const columns: ColumnsType<EmployeeDto> = [
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '岗位', dataIndex: 'title', width: 120, render: (v: string | null) => v ?? '—' },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: EmployeeDto['status']) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '在职' : '停用'}
        </Tag>
      ),
    },
    {
      title: '绑定',
      dataIndex: 'bindingStatus',
      width: 90,
      render: (v: EmployeeDto['bindingStatus']) => (
        <Tag color={v === 'bound' ? 'blue' : 'default'}>{v === 'bound' ? '已绑定' : '未绑定'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          {record.status === 'active' && (
            <Button type="link" size="small" danger onClick={() => handleDeactivate(record)}>
              停用
            </Button>
          )}
          {record.status === 'active' && record.bindingStatus === 'unbound' && (
            <Button
              type="link"
              size="small"
              loading={bindingCodeMutation.isPending && bindingCodeMutation.variables === record.id}
              onClick={() => handleGenerateBindingCode(record)}
            >
              绑定码
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            员工管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            维护科室员工档案，生成小程序绑定码
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增员工
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          allowClear
          placeholder="工号"
          style={{ width: 160 }}
          value={employeeNoInput}
          onChange={(e) => setEmployeeNoInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
        <Input
          allowClear
          placeholder="姓名"
          style={{ width: 160 }}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
        <Input
          allowClear
          placeholder="手机号"
          style={{ width: 220 }}
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
        <Input
          allowClear
          placeholder="岗位"
          style={{ width: 160 }}
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
        <Select
          allowClear
          placeholder="在职状态"
          style={{ width: 120 }}
          value={statusFilterInput}
          onChange={setStatusFilterInput}
          options={[
            { label: '在职', value: 'active' },
            { label: '停用', value: 'inactive' },
          ]}
        />
        <Select
          allowClear
          placeholder="绑定状态"
          style={{ width: 120 }}
          value={bindingStatusFilterInput}
          onChange={setBindingStatusFilterInput}
          options={[
            { label: '已绑定', value: 'bound' },
            { label: '未绑定', value: 'unbound' },
          ]}
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
        loading={isLoading}
        columns={columns}
        dataSource={data?.data ?? []}
        pagination={{
          current: page,
          pageSize,
          total: data?.meta.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 人`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={formMode === 'create' ? '新增员工' : '编辑员工'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
          <Form.Item
            label="工号"
            name="employeeNo"
            rules={[{ required: true, message: '请输入工号' }]}
          >
            <Input placeholder="如 N001" maxLength={20} />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="员工姓名" maxLength={20} />
          </Form.Item>
          <Form.Item label="岗位" name="title">
            <Input placeholder="如 护士" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="手机号"
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入 11 位手机号' },
            ]}
          >
            <Input placeholder="11 位手机号" maxLength={11} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="员工绑定码"
        open={bindingCode !== null}
        onCancel={() => setBindingCode(null)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            if (bindingCode) {
              navigator.clipboard.writeText(bindingCode.code);
              message.success('已复制到剪贴板');
            }
          }}>
            复制绑定码
          </Button>,
          <Button key="close" onClick={() => setBindingCode(null)}>
            关闭
          </Button>,
        ]}
      >
        {bindingCode && (
          <div className="space-y-2 py-2">
            <Typography.Paragraph type="secondary" className="!mb-2">
              请将以下绑定码告知员工，在小程序中输入绑定码及手机号后四位完成绑定。绑定码仅显示一次。
            </Typography.Paragraph>
            <div className="flex flex-col items-center pt-6">
              <Typography.Title level={2} className="!mb-0 tracking-widest">
                {bindingCode.code}
              </Typography.Title>
              <Typography.Text type="secondary" className="mt-4">
                有效期至 {dayjs(bindingCode.expiresAt).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
