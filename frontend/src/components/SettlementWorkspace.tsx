import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { api } from '../api';
import type { Overview, Trip, UserInfo } from '../types';
import RegisterExpenseButton from './RegisterExpenseButton';
import BudgetEditor from './BudgetEditor';
import ExpenseTable from './ExpenseTable';
import NetSettlementPanel from './NetSettlementPanel';

const TRIP_STORAGE_KEY = 'tripmatch_selected_trip';

interface Props {
  user: UserInfo;
}

export default function SettlementWorkspace({ user }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number | null>(
    Number(localStorage.getItem(TRIP_STORAGE_KEY)) || null
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const mine = await api<Trip[]>('/trips/my');
      setTrips(mine);
      if (mine.length > 0) {
        const valid = mine.some(trip => trip.id === tripId) ? tripId : mine[0].id;
        setTripId(valid);
        localStorage.setItem(TRIP_STORAGE_KEY, String(valid));
      } else {
        setTripId(null);
      }
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoadingTrips(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOverview = useCallback(async () => {
    if (!tripId) {
      setOverview(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api<Overview>(`/trips/${tripId}/overview`);
      setOverview(data);
    } catch (error) {
      message.error((error as Error).message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const changeTrip = (next: number) => {
    setTripId(next);
    localStorage.setItem(TRIP_STORAGE_KEY, String(next));
  };

  const nameOf = useCallback(
    (userId: number) => overview?.members.find(member => member.userId === userId)?.nickname ?? `用户${userId}`,
    [overview]
  );

  const generate = async () => {
    if (!tripId) return;
    setGenerating(true);
    try {
      await api(`/trips/${tripId}/settlement/generate`, { method: 'POST' });
      message.success('清算单已生成，确认支出已全部冻结');
      await loadOverview();
    } catch (error) {
      Modal.error({ title: '无法生成清算单', content: (error as Error).message });
      await loadOverview();
    } finally {
      setGenerating(false);
    }
  };

  const joinTrip = async () => {
    const id = Number(window.prompt('输入要加入的行程 ID'));
    if (!id) return;
    try {
      await api(`/trips/${id}/join`, { method: 'POST' });
      message.success('已加入行程');
      await loadTrips();
      changeTrip(id);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const todoItems = overview?.todos ?? [];
  const anomalies = overview?.anomalies ?? [];

  const budgetStats = useMemo(() => overview?.budget, [overview]);

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <span>当前行程：</span>
        <Select
          style={{ minWidth: 300 }}
          loading={loadingTrips}
          value={tripId}
          onChange={changeTrip}
          placeholder="选择我的行程"
          options={trips.map(trip => ({
            value: trip.id,
            label: `${trip.destination} · ${trip.departDate} · ${trip.days}天（#${trip.id}）`
          }))}
        />
        <Button icon={<ReloadOutlined />} onClick={loadOverview}>刷新</Button>
        <Button onClick={joinTrip}>按 ID 加入行程</Button>
        {overview && (
          <>
            <RegisterExpenseButton tripId={tripId!} frozen={overview.frozen} onDone={loadOverview} />
            <BudgetEditor tripId={tripId!} frozen={overview.frozen} budget={overview.budget} onDone={loadOverview} />
          </>
        )}
      </Space>

      {!tripId && !loadingTrips && (
        <Empty description="你还没有加入任何行程。可让行程发布者提供行程 ID 后加入，或在「发布行程」页发布。" />
      )}

      {loading && <Spin style={{ display: 'block', marginTop: 60 }} tip="加载清算数据..." />}

      {overview && (
        <Tabs
          items={[
            {
              key: 'workbench',
              label: '待办与异常',
              children: (
                <Row gutter={16}>
                  <Col span={12}>
                    <Card
                      size="small"
                      title={<span><CheckCircleOutlined /> 我的待办（{todoItems.length}）</span>}
                      extra={overview.frozen ? <Tag color="blue">清算已冻结</Tag> : undefined}
                    >
                      {todoItems.length === 0 ? (
                        <Typography.Text type="secondary">暂无待办：没有需要你确认或重提的支出。</Typography.Text>
                      ) : (
                        <List
                          size="small"
                          dataSource={todoItems}
                          renderItem={todo => (
                            <List.Item>
                              <Space direction="vertical" style={{ width: '100%' }} size={0}>
                                <Space>
                                  <Tag color={todo.type === 'CONFIRM' ? 'gold' : 'red'}>
                                    {todo.type === 'CONFIRM' ? '待我确认' : '待我重提'}
                                  </Tag>
                                  <strong>{todo.title}</strong>
                                  <span>¥{Number(todo.amount).toFixed(2)}</span>
                                  {todo.payerName && <Typography.Text type="secondary">垫付人：{todo.payerName}</Typography.Text>}
                                </Space>
                                {todo.reason && (
                                  <Typography.Text type="danger" style={{ fontSize: 12 }}>驳回原因：{todo.reason}</Typography.Text>
                                )}
                              </Space>
                            </List.Item>
                          )}
                        />
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<span><WarningOutlined /> 异常提醒（{anomalies.length}）</span>}>
                      {anomalies.length === 0 ? (
                        <Typography.Text type="success">
                          <CheckCircleOutlined /> 无异常：没有待重提支出，花费在计划预算内。
                        </Typography.Text>
                      ) : (
                        <List
                          size="small"
                          dataSource={anomalies}
                          renderItem={anomaly => (
                            <List.Item>
                              <Alert
                                style={{ width: '100%' }}
                                type={anomaly.level === 'danger' ? 'error' : 'warning'}
                                showIcon
                                icon={anomaly.type === 'OVER_BUDGET' ? <ThunderboltOutlined /> : <AlertOutlined />}
                                message={anomaly.message}
                              />
                            </List.Item>
                          )}
                        />
                      )}
                    </Card>
                  </Col>
                  <Col span={24} style={{ marginTop: 16 }}>
                    <Card size="small" title="支出统计">
                      <Space size="large" wrap>
                        <Statistic title="待确认" value={overview.counts.pending} valueStyle={{ color: '#d48806' }} />
                        <Statistic title="已确认" value={overview.counts.confirmed} valueStyle={{ color: '#389e0d' }} />
                        <Statistic title="待重提（驳回）" value={overview.counts.rejected} valueStyle={{ color: '#cf1322' }} />
                        <Statistic title="已冻结" value={overview.counts.frozen} valueStyle={{ color: '#096dd9' }} />
                        <Statistic title="登记总数" value={overview.counts.total} />
                        <Statistic
                          title="计划 / 已花费"
                          value={budgetStats ? budgetStats.totalSpent : 0}
                          prefix="¥"
                          suffix={budgetStats ? `/ ¥${budgetStats.totalPlanned.toFixed(2)}` : ''}
                          valueStyle={{ color: budgetStats?.totalExceeded ? '#cf1322' : budgetStats?.totalOverBudget ? '#d46b08' : '#3f8600' }}
                        />
                      </Space>
                    </Card>
                  </Col>
                </Row>
              )
            },
            {
              key: 'expenses',
              label: '支出明细',
              children: (
                <ExpenseTable
                  tripId={tripId!}
                  currentUserId={user.id}
                  expenses={overview.expenses}
                  frozen={overview.frozen}
                  onChanged={loadOverview}
                />
              )
            },
            {
              key: 'budget',
              label: '预算执行',
              children: <BudgetBreakdown overview={overview} />
            },
            {
              key: 'settlement',
              label: '净额与清算',
              children: (
                <NetSettlementPanel overview={overview} nameOf={nameOf} onGenerate={generate} generating={generating} />
              )
            }
          ]}
        />
      )}
    </div>
  );
}

function BudgetBreakdown({ overview }: { overview: Overview }) {
  const budget = overview.budget;
  return (
    <div>
      <Alert
        style={{ marginBottom: 12 }}
        type={budget.totalOverBudget ? 'error' : 'success'}
        showIcon
        message={
          budget.totalExceeded
            ? `总花费已超出计划预算 ¥${budget.totalOverAmount.toFixed(2)}（计划 ¥${budget.totalPlanned.toFixed(
                2
              )} / 已确认花费 ¥${budget.totalSpent.toFixed(2)}）`
            : budget.totalOverBudget
              ? `总额在预算内，但品类超支合计 ¥${budget.categoryOverAmount.toFixed(2)}（计划 ¥${budget.totalPlanned.toFixed(
                  2
                )} / 已确认花费 ¥${budget.totalSpent.toFixed(2)}）`
              : `预算执行正常（计划 ¥${budget.totalPlanned.toFixed(2)} / 已确认花费 ¥${budget.totalSpent.toFixed(2)}）`
        }
        description={
          budget.budgetSource === 'TRIP_MAX' && budget.categories.length === 0
            ? '当前按行程发布时的预算上限判定，可点击「设置计划预算」维护分品类计划。'
            : undefined
        }
      />
      <List
        grid={{ gutter: 16, column: 4 }}
        dataSource={budget.categories}
        renderItem={item => (
          <List.Item>
            <Card size="small" title={item.category}>
              <Statistic
                title="已花费 / 计划"
                value={item.spent}
                precision={2}
                prefix="¥"
                suffix={`/ ¥${item.planned.toFixed(2)}`}
                valueStyle={{ color: item.overBudget ? '#cf1322' : '#3f8600' }}
              />
              {item.overBudget && <Tag color="red" style={{ marginTop: 8 }}>超支 ¥{item.overAmount.toFixed(2)}</Tag>}
            </Card>
          </List.Item>
        )}
      />
      {budget.categories.length === 0 && <Empty description="尚未设置分品类预算，将按行程预算上限判定超支" />}
    </div>
  );
}
