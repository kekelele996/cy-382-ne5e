import { Alert, Button, Descriptions, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Overview, Settlement } from '../types';

interface Props {
  overview: Overview;
  nameOf: (userId: number) => string;
  onGenerate: () => void;
  generating: boolean;
}

/** 净额面板：清算前展示按已确认支出的预估，清算后展示冻结清算单，均保证零和。 */
export default function NetSettlementPanel({ overview, nameOf, onGenerate, generating }: Props) {
  const settlement: Settlement | null = overview.settlement;
  const source = settlement
    ? { total: settlement.totalAmount, perPerson: settlement.perPerson, items: settlement.items }
    : overview.projectedNet;

  const netSum = settlement ? Number(settlement.netSum) : source.items.reduce((sum, item) => sum + Number(item.net), 0);

  const columns: ColumnsType<{ userId: number; paid: number; share: number; net: number }> = [
    { title: '成员', dataIndex: 'userId', render: (userId: number) => nameOf(userId) },
    { title: '垫付合计', dataIndex: 'paid', align: 'right' as const, render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '人均均摊', dataIndex: 'share', align: 'right' as const, render: (v: number) => `¥${Number(v).toFixed(2)}` },
    {
      title: '净额（正应收/负应付）',
      dataIndex: 'net',
      align: 'right' as const,
      render: (v: number) => {
        const net = Number(v);
        const color = net > 0 ? '#389e0d' : net < 0 ? '#cf1322' : '#8c8c8c';
        const text = net > 0 ? `应收 ¥${net.toFixed(2)}` : net < 0 ? `应付 ¥${Math.abs(net).toFixed(2)}` : '¥0.00 两清';
        return <strong style={{ color }}>{text}</strong>;
      }
    }
  ];

  return (
    <div>
      {settlement ? (
        <Alert
          type={settlement.overBudget ? 'error' : 'success'}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              清算单已生成并冻结（{new Date(settlement.createdAt).toLocaleString()}，共 {settlement.memberCount} 人）
              {settlement.overBudget && <Tag color="red" style={{ marginLeft: 8 }}>超计划预算</Tag>}
            </span>
          }
          description={
            settlement.overBudget
              ? settlement.overBudgetDetail?.totalExceeded
                ? `总花费超出计划预算 ¥${Number(settlement.overBudgetDetail?.totalOverAmount ?? 0).toFixed(2)}；` +
                  (settlement.overBudgetDetail?.categories.length
                    ? `分品类超支：${settlement.overBudgetDetail.categories.map(c => `${c.category}超 ¥${Number(c.overAmount).toFixed(2)}`).join('；')}`
                    : '')
                : settlement.overBudgetDetail?.categories.length
                  ? `总额仍在总预算内，但以下品类超支：${settlement.overBudgetDetail.categories
                      .map(c => `${c.category}超 ¥${Number(c.overAmount).toFixed(2)}`)
                      .join('；')}`
                  : '花费超出计划预算。'
              : '各品类花费均在计划预算内。'
          }
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="尚未生成清算单，下表为按当前已确认支出的预估值；待确认/待重提支出未计入。"
          action={
            <Button
              type="primary"
              loading={generating}
              disabled={!overview.canSettle}
              onClick={onGenerate}
              style={{ marginLeft: 8 }}
            >
              生成清算单
            </Button>
          }
        />
      )}

      <Descriptions size="small" column={4} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="确认支出总额">
          <Statistic value={Number(source.total)} precision={2} prefix="¥" />
        </Descriptions.Item>
        <Descriptions.Item label="人均均摊">
          <Statistic value={Number(source.perPerson)} precision={2} prefix="¥" />
        </Descriptions.Item>
        <Descriptions.Item label="净额合计（零和校验）">
          <Statistic value={Number(netSum)} precision={2} prefix="¥" valueStyle={{ color: Math.abs(Number(netSum)) < 0.005 ? '#3f8600' : '#cf1322' }} />
        </Descriptions.Item>
        <Descriptions.Item label="预算状态">
          {overview.budget.totalExceeded
            ? <Tag color="red">总额超支 ¥{Number(overview.budget.totalOverAmount).toFixed(2)}</Tag>
            : overview.budget.totalOverBudget
              ? <Tag color="orange">品类超支 ¥{Number(overview.budget.categoryOverAmount).toFixed(2)}</Tag>
              : <Tag color="green">预算内</Tag>}
        </Descriptions.Item>
      </Descriptions>

      <Table rowKey="userId" size="small" pagination={false} columns={columns} dataSource={source.items} />
    </div>
  );
}
