import { Button, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api';
import type { Expense } from '../types';
import RejectButton from './RejectButton';
import ResubmitButton from './ResubmitButton';

const STATUS_META: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'gold', text: '待确认' },
  CONFIRMED: { color: 'green', text: '已确认' },
  REJECTED: { color: 'red', text: '已驳回·待重提' },
  FROZEN: { color: 'blue', text: '已冻结' }
};

interface Props {
  tripId: number;
  currentUserId: number;
  expenses: Expense[];
  frozen: boolean;
  onChanged: () => void;
}

export default function ExpenseTable({ tripId, currentUserId, expenses, frozen, onChanged }: Props) {
  const confirm = async (expenseId: number) => {
    try {
      await api(`/trips/${tripId}/expenses/${expenseId}/confirm`, { method: 'POST' });
      onChanged();
    } catch (error) {
      onChanged();
    }
  };

  const columns: ColumnsType<Expense> = [
    { title: '票据号', dataIndex: 'receiptNo', width: 170 },
    { title: '说明', dataIndex: 'title' },
    { title: '类别', dataIndex: 'category', width: 80 },
    { title: '金额', dataIndex: 'amount', width: 110, align: 'right', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '垫付人', dataIndex: 'payerName', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string, row) => {
        const meta = STATUS_META[status] ?? { color: 'default', text: status };
        return (
          <div>
            <Tag color={meta.color}>{meta.text}</Tag>
            {status === 'CONFIRMED' && row.confirmerName && <small>由 {row.confirmerName} 确认</small>}
            {status === 'REJECTED' && (
              <small style={{ color: '#cf1322' }}>
                {row.rejecterName ? `${row.rejecterName}驳回` : '已驳回'}
                {row.rejectReason ? `：${row.rejectReason}` : ''}
              </small>
            )}
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 210,
      render: (_: unknown, row: Expense) => {
        if (frozen || row.status === 'FROZEN') return <span style={{ color: '#999' }}>已随清算冻结</span>;
        if (row.status === 'PENDING') {
          if (row.payerId === currentUserId) {
            return <span style={{ color: '#999' }}>等待其他成员确认</span>;
          }
          return (
            <Space>
              <Button size="small" type="primary" onClick={() => confirm(row.id)}>确认</Button>
              <RejectButton tripId={tripId} expenseId={row.id} onDone={onChanged} />
            </Space>
          );
        }
        if (row.status === 'CONFIRMED') {
          return <span style={{ color: '#52c41a' }}>已计入{row.confirmerName ? `（${row.confirmerName}）` : ''}</span>;
        }
        if (row.status === 'REJECTED' && row.payerId === currentUserId) {
          return <ResubmitButton tripId={tripId} expense={row} onDone={onChanged} />;
        }
        return <span style={{ color: '#999' }}>等待登记人重提</span>;
      }
    }
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={expenses}
      pagination={false}
      rowClassName={row => (row.status === 'REJECTED' ? 'row-rejected' : '')}
    />
  );
}
