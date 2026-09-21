import { useEffect, useState } from 'react';
import { Button, Form, InputNumber, Modal, Space, Table, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { BudgetSummary } from '../types';

interface Props {
  tripId: number;
  frozen: boolean;
  budget: BudgetSummary;
  onDone: () => void;
}

interface PlanRow { category: string; planned: number }

/** 维护分品类计划预算（交通/住宿/餐饮/门票），清算时据此标记超支。 */
export default function BudgetEditor({ tripId, frozen, budget, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(
        budget.categories.length > 0
          ? budget.categories.map(item => ({ category: item.category, planned: item.planned }))
          : ['交通', '住宿', '餐饮', '门票'].map(category => ({ category, planned: 0 }))
      );
    }
  }, [open, budget]);

  const save = async () => {
    if (rows.some(row => !row.category)) {
      message.error('类别名称不能为空');
      return;
    }
    setSaving(true);
    try {
      await api(`/trips/${tripId}/budgets`, {
        method: 'PUT',
        body: JSON.stringify({ items: rows.filter(row => row.planned > 0) })
      });
      setOpen(false);
      onDone();
      message.success('计划预算已保存');
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button disabled={frozen} onClick={() => setOpen(true)}>设置计划预算</Button>
      <Modal
        title="计划预算（分品类）"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText="保存"
        width={560}
        destroyOnClose
      >
        <Table
          rowKey={(row, index) => `${row.category}-${index}`}
          size="small"
          pagination={false}
          dataSource={rows}
          columns={[
            { title: '类别', dataIndex: 'category', render: (value: string, _row, index) => (
              <Space>
                <input
                  value={value}
                  disabled={frozen}
                  onChange={event => {
                    const next = [...rows];
                    next[index] = { ...next[index], category: event.target.value };
                    setRows(next);
                  }}
                />
              </Space>
            ) },
            { title: '计划金额（元）', dataIndex: 'planned', width: 180, render: (value: number, _row, index) => (
              <InputNumber
                min={0}
                precision={2}
                value={value}
                disabled={frozen}
                onChange={planned => {
                  const next = [...rows];
                  next[index] = { ...next[index], planned: Number(planned ?? 0) };
                  setRows(next);
                }}
              />
            ) },
            { title: '', width: 48, render: (_v, _row, index) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={frozen}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              />
            ) }
          ]}
          footer={() => (
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              disabled={frozen}
              onClick={() => setRows([...rows, { category: '', planned: 0 }])}
            >
              新增类别
            </Button>
          )}
        />
      </Modal>
    </>
  );
}
