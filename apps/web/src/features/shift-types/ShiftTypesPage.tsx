import {
  App,
  Button,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ShiftTypeDto } from '@easyshift/shared-types';
import dayjs from 'dayjs';
import { useState } from 'react';
import {
  formatShiftTimeRange,
  getApiErrorMessage,
  useCreateShiftType,
  useDeactivateShiftType,
  useShiftTypes,
  useUpdateShiftType,
  type ShiftTypeFormValues,
  SHIFT_TYPE_KIND_LABELS,
  SHIFT_TYPE_KINDS,
} from './api';

type FormMode = 'create' | 'edit';

function parseStartTime(value: string | null): dayjs.Dayjs | null {
  if (!value) {
    return null;
  }
  return dayjs(`2000-01-01T${value}`);
}

function formatStartTime(value: dayjs.Dayjs | null): string | null {
  if (!value) {
    return null;
  }
  return value.format('HH:mm:ss');
}

export function ShiftTypesPage() {
  const { modal } = App.useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingShiftType, setEditingShiftType] = useState<ShiftTypeDto | null>(null);

  const [form] = Form.useForm<ShiftTypeFormValues & { startTimePicker?: dayjs.Dayjs | null }>();

  const { data, isLoading } = useShiftTypes();
  const createMutation = useCreateShiftType();
  const updateMutation = useUpdateShiftType();
  const deactivateMutation = useDeactivateShiftType();

  const openCreate = () => {
    setFormMode('create');
    setEditingShiftType(null);
    form.resetFields();
    form.setFieldsValue({
      color: '#4CAF50',
      kind: 'day',
      minRequiredCount: 0,
      sortOrder: (data?.length ?? 0) + 1,
    });
    setFormOpen(true);
  };

  const openEdit = (shiftType: ShiftTypeDto) => {
    setFormMode('edit');
    setEditingShiftType(shiftType);
    form.setFieldsValue({
      code: shiftType.code,
      name: shiftType.name,
      kind: shiftType.kind,
      startTimePicker: parseStartTime(shiftType.startTime),
      durationMinutes: shiftType.durationMinutes,
      color: shiftType.color,
      minRequiredCount: shiftType.minRequiredCount,
      sortOrder: shiftType.sortOrder,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (
    values: ShiftTypeFormValues & { startTimePicker?: dayjs.Dayjs | null },
  ) => {
    const payload: ShiftTypeFormValues = {
      code: values.code,
      name: values.name,
      kind: values.kind,
      startTime: formatStartTime(values.startTimePicker ?? null),
      durationMinutes: values.durationMinutes ?? null,
      color: typeof values.color === 'string' ? values.color : String(values.color),
      minRequiredCount: values.minRequiredCount,
      sortOrder: values.sortOrder,
    };

    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(payload);
        message.success('班次类型已新增');
      } else if (editingShiftType) {
        await updateMutation.mutateAsync({ id: editingShiftType.id, ...payload });
        message.success('班次类型已更新');
      }
      setFormOpen(false);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleDeactivate = (shiftType: ShiftTypeDto) => {
    modal.confirm({
      title: '确认停用班次类型？',
      content: `停用后「${shiftType.name}（${shiftType.code}）」不可用于新排班，历史数据保留。`,
      okText: '停用',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deactivateMutation.mutateAsync(shiftType.id);
          message.success('班次类型已停用');
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<ShiftTypeDto> = [
    {
      title: '代码',
      dataIndex: 'code',
      width: 80,
      render: (code: string, record) => (
        <Space size="small">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: record.color }}
          />
          <span className="font-medium">{code}</span>
        </Space>
      ),
    },
    { title: '名称', dataIndex: 'name', width: 120 },
    {
      title: '规则类型',
      dataIndex: 'kind',
      width: 120,
      render: (kind: ShiftTypeDto['kind']) => SHIFT_TYPE_KIND_LABELS[kind],
    },
    {
      title: '时间段',
      key: 'timeRange',
      width: 140,
      render: (_, record) =>
        formatShiftTimeRange(record.startTime, record.durationMinutes),
    },
    {
      title: '时长(分钟)',
      dataIndex: 'durationMinutes',
      width: 100,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: '最低人数',
      dataIndex: 'minRequiredCount',
      width: 90,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 70,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: ShiftTypeDto['status']) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
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
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            班次类型
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            配置本科室班次模板；代码/名称可按习惯显示，规则类型决定排班校验语义
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增班次
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data ?? []}
        pagination={false}
      />

      <Modal
        title={formMode === 'create' ? '新增班次类型' : '编辑班次类型'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
          <Form.Item
            label="代码"
            name="code"
            rules={[{ required: true, message: '请输入班次代码' }]}
          >
            <Input placeholder="如 D、N、白、夜、DAY" maxLength={10} />
          </Form.Item>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入班次名称' }]}
          >
            <Input placeholder="如 白班、大夜班、Day Shift" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="规则类型"
            name="kind"
            rules={[{ required: true, message: '请选择规则类型' }]}
            extra="决定连续大夜、大夜后白班等校验；与显示用的代码/名称无关"
          >
            <Select
              options={SHIFT_TYPE_KINDS.map((kind) => ({
                value: kind,
                label: SHIFT_TYPE_KIND_LABELS[kind],
              }))}
            />
          </Form.Item>
          <Form.Item label="开始时间" name="startTimePicker">
            <TimePicker format="HH:mm" className="w-full" allowClear />
          </Form.Item>
          <Form.Item label="时长（分钟）" name="durationMinutes">
            <InputNumber min={0} className="w-full" placeholder="如 480，休息班可留空" />
          </Form.Item>
          <Form.Item
            label="颜色"
            name="color"
            rules={[{ required: true, message: '请选择颜色' }]}
            getValueFromEvent={(color) => color.toHexString()}
          >
            <ColorPicker showText format="hex" />
          </Form.Item>
          <Form.Item
            label="最低覆盖人数"
            name="minRequiredCount"
            rules={[{ required: true, message: '请输入最低覆盖人数' }]}
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item
            label="排序"
            name="sortOrder"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <InputNumber className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
