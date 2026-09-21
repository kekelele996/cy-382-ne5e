import { useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import { api } from '../api';
import type { Expense } from '../types';

const CATEGORIES = ['交通', '住宿', '餐饮', '门票'];

interface Props {
  tripId: number;
  expense: Expense;
  onDone: () => void;
}

/** 登记人针对被驳回支出修正后重提，重新进入待确认。 */
export default function ResubmitButton({ tripId, expense, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (values: { receiptNo: string; title: string; category: string; amount: number }) => {
    setLoading(true);
    try {
      await api(`/trips/${tripId}/expenses/${expense.id}/resubmit`, {
        method: 'POST',
        body: JSON.stringify(values)
      });
      setOpen(false);
      onDone();
    } catch (error) {
      Modal.error({ title: '重提失败', content: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="small" type="primary" danger onClick={() => setOpen(true)}>修改后重提</Button>
      <Modal title="重提被驳回的支出" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form
          layout="vertical"
          initialValues={{ receiptNo: expense.receiptNo, title: expense.title, category: expense.category, amount: expense.amount }}
          onFinish={values => submit(values as { receiptNo: string; title: string; category: string; amount: number })}
        >
          <Form.Item name="receiptNo" label="票据号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="title" label="支出说明" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="费用类别" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map(value => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="amount" label="金额（元）" rules={[{ required: true }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>提交重提，等待确认</Button>
        </Form>
      </Modal>
    </>
  );
}
