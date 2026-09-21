import { Alert, Badge, Button, Card, Col, Descriptions, Empty, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { Budget, CurrentUser, Expense, Member, Settlement, Trip } from '../types';

const CATEGORY_OPTIONS = ['交通', '住宿', '餐饮', '门票', '其他'].map(value => ({ value, label: value }));

const STATUS_META: Record<Expense['status'], { color: string; label: string }> = {
  PENDING: { color: 'gold', label: '待确认' },
  CONFIRMED: { color: 'green', label: '已确认' },
  REJECTED: { color: 'red', label: '待重提' },
  SETTLED: { color: 'blue', label: '已清算' }
};

const fmt = (value: number | string) => `¥${Number(value || 0).toFixed(2)}`;

interface Props {
  user: CurrentUser | null;
  trips: Trip[];
}

export default function SettlementPage({ user, trips }: Props) {
  const [tripId, setTripId] = useState<number>();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<Expense | null>(null);
  const [registerForm] = Form.useForm();
  const [budgetForm] = Form.useForm();
  const [resubmitForm] = Form.useForm();

  const trip = trips.find(item => item.id === tripId);
  const isMember = !!user && members.some(item => item.userId === user.id);
  const nicknameOf = useCallback((userId: number) => members.find(item => item.userId === userId)?.nickname ?? `#${userId}`, [members]);

  const reload = useCallback(async (id: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const [memberList, expenseList, budgetList] = await Promise.all([
        api<Member[]>(`/trips/${id}/members`),
        api<Expense[]>(`/expenses?tripId=${id}`),
        api<Budget[]>(`/trips/${id}/budgets`)
      ]);
      setMembers(memberList);
      setExpenses(expenseList);
      setBudgets(budgetList);
      try {
        setSettlement(await api<Settlement>(`/settlements?tripId=${id}`));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'SETTLEMENT_NOT_FOUND') setSettlement(null);
        else throw error;
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_TRIP_MEMBER') {
        setExpenses([]);
        setBudgets([]);
        setSettlement(null);
        try { setMembers(await api<Member[]>(`/trips/${id}/members`)); } catch { setMembers([]); }
      } else {
        message.error(error instanceof Error ? error.message : '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!tripId && trips.length > 0) setTripId(trips[0].id); }, [trips, tripId]);
  useEffect(() => { if (tripId) reload(tripId); }, [tripId, reload]);

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      if (success) message.success(success);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      if (tripId) reload(tripId);
    }
  }, [tripId, reload]);

  const joinTrip = () => run(() => api(`/trips/${tripId}/join`, { method: 'POST' }), '已加入行程');
  const registerExpense = (values: any) => run(async () => {
    await api('/expenses', { method: 'POST', body: JSON.stringify({ tripId, ...values }) });
    registerForm.resetFields();
  }, '支出已登记，等待其他成员确认');
  const confirmExpense = (id: number) => run(() => api(`/expenses/${id}/confirm`, { method: 'POST' }), '已确认该笔支出');
  const rejectExpense = (id: number) => run(() => api(`/expenses/${id}/reject`, { method: 'POST' }), '已驳回，等待登记人重新提交');
  const saveBudget = (values: any) => run(() => api(`/trips/${tripId}/budgets`, { method: 'POST', body: JSON.stringify(values) }), '预算已保存');
  const generateSettlement = () => run(() => api<Settlement>('/settlements', { method: 'POST', body: JSON.stringify({ tripId }) }), '清算单已生成');
  const resubmitExpense = (values: any) => run(async () => {
    await api(`/expenses/${resubmitTarget!.id}/resubmit`, { method: 'POST', body: JSON.stringify(values) });
    setResubmitTarget(null);
  }, '已重新提交，等待其他成员确认');

  const confirmedTotal = useMemo(
    () => expenses.filter(item => item.status === 'CONFIRMED' || item.status === 'SETTLED').reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses]
  );
  const plannedTotal = useMemo(() => budgets.reduce((sum, item) => sum + Number(item.planned), 0), [budgets]);
  const planned = plannedTotal > 0 ? plannedTotal : Number(trip?.budgetMax ?? 0);
  const liveOverBudget = planned > 0 && confirmedTotal > planned;

  const todoExpenses = useMemo(() => expenses.filter(item => item.status === 'PENDING'), [expenses]);
  const rejectedExpenses = useMemo(() => expenses.filter(item => item.status === 'REJECTED'), [expenses]);
  const unresolvedCount = todoExpenses.length + rejectedExpenses.length;
  const netSum = useMemo(() => settlement?.shares.reduce((sum, item) => sum + Number(item.net), 0) ?? 0, [settlement]);

  if (!user) return <Alert type="info" showIcon message="请先在左侧登录，登录后可登记支出、确认他人支出并生成清算单。" />;
  if (trips.length === 0) return <Empty description="还没有行程，请先在「发布行程」中创建行程" />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card loading={loading && !trip}>
        <Space wrap size="middle">
          <span>选择行程：</span>
          <Select
            style={{ minWidth: 260 }}
            value={tripId}
            onChange={setTripId}
            options={trips.map(item => ({ value: item.id, label: `${item.destination} · ${item.departDate} · ${item.status}` }))}
          />
          {isMember ? <Tag color="green">我已是成员</Tag> : <Button type="primary" onClick={joinTrip}>加入该行程</Button>}
          <span>成员：</span>
          {members.map(item => <Tag key={item.userId} color={item.userId === user.id ? 'geekblue' : undefined}>{item.nickname ?? `#${item.userId}`}</Tag>)}
        </Space>
      </Card>

      {tripId && !isMember && <Alert type="warning" showIcon message="你还不是该行程成员，加入后才能登记支出、确认支出与查看清算。" />}

      {isMember && (
        <>
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="计划预算" value={planned} precision={2} prefix="¥" /></Card></Col>
            <Col span={6}><Card><Statistic title="已确认支出" value={confirmedTotal} precision={2} prefix="¥" /></Card></Col>
            <Col span={6}><Card><Statistic title="剩余预算" value={planned - confirmedTotal} precision={2} prefix="¥" valueStyle={{ color: liveOverBudget ? '#cf1322' : undefined }} /></Card></Col>
            <Col span={6}>
              <Card>
                <Statistic title="预算状态" valueRender={() => liveOverBudget || settlement?.overBudget
                  ? <Tag color="red" style={{ fontSize: 16 }}>超支 {fmt((settlement ? Number(settlement.totalAmount) : confirmedTotal) - (settlement ? Number(settlement.plannedBudget) : planned))}</Tag>
                  : <Tag color="green" style={{ fontSize: 16 }}>未超支</Tag>} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Card title="登记支出（本人垫付）" size="small">
                <Form form={registerForm} layout="inline" onFinish={registerExpense} disabled={!!settlement}>
                  <Form.Item name="receiptNo" rules={[{ required: true, message: '请输入票据号' }, { max: 64 }]}><Input placeholder="票据号（同行程唯一）" style={{ width: 170 }} /></Form.Item>
                  <Form.Item name="category" rules={[{ required: true, message: '请选择类别' }]}><Select placeholder="类别" style={{ width: 100 }} options={CATEGORY_OPTIONS} /></Form.Item>
                  <Form.Item name="amount" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0.01} max={99999999.99} precision={2} placeholder="金额" style={{ width: 120 }} /></Form.Item>
                  <Form.Item name="note"><Input placeholder="备注（可选）" style={{ width: 140 }} /></Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit">登记</Button></Form.Item>
                </Form>
                {settlement && <Alert style={{ marginTop: 12 }} type="info" showIcon message="清算单已生成，支出已冻结，不能再登记。" />}
              </Card>
              <Card title="分类预算设置" size="small" style={{ marginTop: 16 }}>
                <Form form={budgetForm} layout="inline" onFinish={saveBudget}>
                  <Form.Item name="category" rules={[{ required: true, message: '请选择类别' }]}><Select placeholder="类别" style={{ width: 110 }} options={CATEGORY_OPTIONS} /></Form.Item>
                  <Form.Item name="planned" rules={[{ required: true, message: '请输入预算' }]}><InputNumber min={0} max={99999999.99} precision={2} placeholder="计划金额" style={{ width: 140 }} /></Form.Item>
                  <Form.Item><Button htmlType="submit">保存预算</Button></Form.Item>
                </Form>
                <Table
                  style={{ marginTop: 12 }}
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={budgets}
                  columns={[
                    { title: '类别', dataIndex: 'category' },
                    { title: '计划金额', dataIndex: 'planned', render: fmt }
                  ]}
                />
              </Card>
            </Col>
            <Col span={14}>
              <Card title={<Badge count={todoExpenses.length} size="small"><span>待办 · 待确认支出</span></Badge>} size="small">
                <List
                  size="small"
                  locale={{ emptyText: '暂无待确认支出' }}
                  dataSource={todoExpenses}
                  renderItem={item => (
                    <List.Item
                      actions={item.payerId === user.id
                        ? [<Tag key="wait" color="gold">等待其他成员确认</Tag>]
                        : [
                            <Button key="ok" type="link" onClick={() => confirmExpense(item.id)}>确认</Button>,
                            <Popconfirm key="no" title="驳回该笔支出？" description="驳回后需登记人重新提交" onConfirm={() => rejectExpense(item.id)}><Button type="link" danger>驳回</Button></Popconfirm>
                          ]}
                    >
                      <List.Item.Meta
                        title={<Space><Tag>{item.category}</Tag>{fmt(item.amount)}<span>票据号 {item.receiptNo}</span></Space>}
                        description={`${nicknameOf(item.payerId)} 垫付${item.note ? ` · ${item.note}` : ''}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
              <Card title={<Badge count={rejectedExpenses.length} size="small" color="red"><span>异常 · 待重提支出</span></Badge>} size="small" style={{ marginTop: 16 }}>
                <List
                  size="small"
                  locale={{ emptyText: '暂无待重提支出' }}
                  dataSource={rejectedExpenses}
                  renderItem={item => (
                    <List.Item
                      actions={item.payerId === user.id
                        ? [<Button key="edit" type="link" onClick={() => { setResubmitTarget(item); resubmitForm.setFieldsValue({ receiptNo: item.receiptNo, category: item.category, amount: Number(item.amount), note: item.note ?? undefined }); }}>修改并重提</Button>]
                        : [<Tag key="wait" color="red">等待 {nicknameOf(item.payerId)} 重新提交</Tag>]}
                    >
                      <List.Item.Meta
                        title={<Space><Tag>{item.category}</Tag>{fmt(item.amount)}<span>票据号 {item.receiptNo}</span></Space>}
                        description={`${nicknameOf(item.payerId)} 垫付 · 被 ${nicknameOf(item.confirmedBy ?? 0)} 驳回`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card title="支出记录" size="small">
            <Table
              size="small"
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 8 }}
              dataSource={expenses}
              columns={[
                { title: '票据号', dataIndex: 'receiptNo' },
                { title: '类别', dataIndex: 'category', render: value => <Tag>{value}</Tag> },
                { title: '金额', dataIndex: 'amount', render: fmt },
                { title: '垫付人', dataIndex: 'payerId', render: nicknameOf },
                { title: '状态', dataIndex: 'status', render: (value: Expense['status']) => <Tag color={STATUS_META[value].color}>{STATUS_META[value].label}</Tag> },
                { title: '登记时间', dataIndex: 'createdAt', render: value => new Date(value).toLocaleString() }
              ]}
            />
          </Card>

          <Card
            title="费用清算"
            size="small"
            extra={!settlement && (
              <Popconfirm
                title="生成清算单？"
                description={unresolvedCount > 0 ? `还有 ${unresolvedCount} 笔待确认/待重提支出，处理完后才能生成` : '生成后支出将冻结，按已确认支出均摊'}
                okButtonProps={{ disabled: unresolvedCount > 0 }}
                onConfirm={generateSettlement}
              >
                <Button type="primary" disabled={unresolvedCount > 0}>生成清算单</Button>
              </Popconfirm>
            )}
          >
            {unresolvedCount > 0 && !settlement && (
              <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={`存在 ${unresolvedCount} 笔待确认或待重提支出，处理完成前不能生成清算单。`} />
            )}
            {settlement ? (
              <>
                <Descriptions size="small" column={4} style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="清算总额">{fmt(settlement.totalAmount)}</Descriptions.Item>
                  <Descriptions.Item label="计划预算">{fmt(settlement.plannedBudget)}</Descriptions.Item>
                  <Descriptions.Item label="参与人数">{settlement.memberCount}</Descriptions.Item>
                  <Descriptions.Item label="预算状态">{settlement.overBudget ? <Tag color="red">超支</Tag> : <Tag color="green">未超支</Tag>}</Descriptions.Item>
                </Descriptions>
                {settlement.overBudget && (
                  <Alert style={{ marginBottom: 12 }} type="error" showIcon message={`已确认支出 ${fmt(settlement.totalAmount)} 超出计划预算 ${fmt(settlement.plannedBudget)}，超支 ${fmt(Number(settlement.totalAmount) - Number(settlement.plannedBudget))}。`} />
                )}
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={settlement.shares}
                  columns={[
                    { title: '成员', dataIndex: 'userId', render: nicknameOf },
                    { title: '确认垫付', dataIndex: 'paid', render: fmt },
                    { title: '应分摊', dataIndex: 'share', render: fmt },
                    {
                      title: '净额（正收负付）',
                      dataIndex: 'net',
                      render: value => {
                        const num = Number(value);
                        return <span style={{ color: num > 0 ? '#3f8600' : num < 0 ? '#cf1322' : undefined }}>{num > 0 ? `应收 ${fmt(num)}` : num < 0 ? `应付 ${fmt(-num)}` : '¥0.00'}</span>;
                      }
                    }
                  ]}
                  footer={() => (
                    <Space>
                      <span>净额合计：</span>
                      <Tag color={Math.abs(netSum) < 0.005 ? 'green' : 'red'}>{fmt(netSum)}（零和校验）</Tag>
                      <span>清算时间：{new Date(settlement.createdAt).toLocaleString()}</span>
                    </Space>
                  )}
                />
              </>
            ) : (
              <Alert type="info" showIcon message="所有支出确认完毕后，点击右上角「生成清算单」，系统将按已确认支出计算每人净额并冻结支出。" />
            )}
          </Card>
        </>
      )}

      <Modal
        title="修改并重新提交支出"
        open={!!resubmitTarget}
        onCancel={() => setResubmitTarget(null)}
        onOk={() => resubmitForm.submit()}
        destroyOnClose
      >
        <Form form={resubmitForm} layout="vertical" onFinish={resubmitExpense}>
          <Form.Item name="receiptNo" label="票据号" rules={[{ required: true, message: '请输入票据号' }, { max: 64 }]}><Input /></Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}><Select options={CATEGORY_OPTIONS} /></Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0.01} max={99999999.99} precision={2} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label="备注"><Input /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
