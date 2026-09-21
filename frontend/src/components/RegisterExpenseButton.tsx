import { useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import { api } from '../api';
import type { Expense } from '../types';

const CATEGORIES = ['交通', '住宿', '餐饮', '门票'];

interface Props {
  tripId: number;
  frozen: boolean;
  onDone: () => void;
}

export default function RegisterExpenseButton({ tripId, frozen, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (values: { receiptNo: string; title: string; category: string; amount: number }) => {
    setLoading(true);
    try {
      await api<Expense>(`/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(values) });
      setOpen(false);
      onDone();
    } catch (error) {
      Modal.error({ title: '登记失败', content: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="primary" disabled={frozen} onClick={() => setOpen(true)}>
        登记垫付支出
      </Button>
      <Modal title="登记本人垫付支出" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form
          layout="vertical"
          initialValues={{ category: '餐饮' }}
          onFinish={values => submit(values as { receiptNo: string; title: string; category: string; amount: number })}
        >
          <Form.Item name="receiptNo" label="票据号" rules={[{ required: true, message: '同行程票据号不可重复' }]}>
            <Input placeholder="如 INV-20260712-01" />
          </Form.Item>
          <Form.Item name="title" label="支出说明" rules={[{ required: true, message: '请填写支出说明' }]}>
            <Input placeholder="如 洱海骑行租车费" />
          </Form.Item>
          <Form.Item name="category" label="费用类别" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map(value => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="amount" label="金额（元）" rules={[{ required: true, message: '请填写大于 0 的金额' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>提交登记（等待其他成员确认）</Button>
        </Form>
      </Modal>
    </>
  );
}
