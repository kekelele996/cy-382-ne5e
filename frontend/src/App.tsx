import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Layout, List, Row, Select, Tabs, Tag, message } from 'antd';
import { EnvironmentOutlined, MessageOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setToken } from './api';
import SettlementPage from './pages/SettlementPage';
import type { CurrentUser, Trip } from './types';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem('tm_user');
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [messages, setMessages] = useState(['系统：已进入行程协作空间']);
  const socket = useMemo(() => io('/', { path: '/socket.io' }), []);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [publishForm] = Form.useForm();

  const loadTrips = useCallback(() => {
    api<Trip[]>('/trips').then(setTrips).catch(() => undefined);
  }, []);
  useEffect(() => { loadTrips(); }, [loadTrips]);

  const saveSession = (token: string, current: CurrentUser) => {
    setToken(token);
    localStorage.setItem('tm_user', JSON.stringify(current));
    setUser(current);
  };

  const login = async (values: any) => {
    try {
      const result = await api<{ token: string; user: CurrentUser } | null>('/users/login', { method: 'POST', body: JSON.stringify(values) });
      if (!result?.token) throw new Error('邮箱或密码不正确');
      saveSession(result.token, result.user);
      message.success(`欢迎，${result.user.nickname}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    }
  };

  const register = async (values: any) => {
    try {
      await api('/users/register', { method: 'POST', body: JSON.stringify(values) });
      message.success('注册成功，请登录');
      registerForm.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '注册失败');
    }
  };

  const logout = () => {
    setToken('');
    localStorage.removeItem('tm_user');
    setUser(null);
  };

  const publish = async (values: any) => {
    try {
      await api('/trips', {
        method: 'POST',
        body: JSON.stringify({
          destination: values.destination,
          departDate: values.departDate?.format('YYYY-MM-DD'),
          days: values.days,
          budgetMin: values.budgetMin,
          budgetMax: values.budgetMax,
          transport: values.transport,
          companionCount: values.companionCount,
          genderPreference: values.genderPreference
        })
      });
      message.success('行程已发布，你已自动成为行程成员');
      publishForm.resetFields();
      loadTrips();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布失败');
    }
  };

  const joinTrip = async (tripId: number) => {
    try {
      await api(`/trips/${tripId}/join`, { method: 'POST' });
      message.success('已加入行程，可在「费用清算」中查看');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加入失败');
    }
  };

  const send = () => {
    socket.emit('trip-message', { tripId: 1, sender: user?.nickname ?? '我', content: '今晚确认民宿地址', type: 'text' });
    setMessages(items => [...items, `${user?.nickname ?? '我'}：今晚确认民宿地址`]);
  };

  return (
    <Layout className="shell">
      <Layout.Sider width={260} className="side">
        <h1>旅伴匹配</h1>
        <p>TripMatch</p>
        {user ? (
          <Card size="small">
            <p>当前用户：<b>{user.nickname}</b></p>
            <Button block onClick={logout}>退出登录</Button>
          </Card>
        ) : (
          <Card size="small">
            <Tabs
              size="small"
              items={[
                {
                  key: 'login',
                  label: '登录',
                  children: (
                    <Form form={loginForm} layout="vertical" onFinish={login}>
                      <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }]}><Input /></Form.Item>
                      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password /></Form.Item>
                      <Button type="primary" htmlType="submit" block>登录</Button>
                    </Form>
                  )
                },
                {
                  key: 'register',
                  label: '注册',
                  children: (
                    <Form form={registerForm} layout="vertical" onFinish={register}>
                      <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }]}><Input /></Form.Item>
                      <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}><Input /></Form.Item>
                      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password /></Form.Item>
                      <Button type="primary" htmlType="submit" block>注册</Button>
                    </Form>
                  )
                }
              ]}
            />
          </Card>
        )}
      </Layout.Sider>
      <Layout.Content className="content">
        <Tabs
          items={[
            {
              key: 'publish',
              label: '发布行程',
              children: (
                <Card>
                  <Form form={publishForm} layout="vertical" className="form" onFinish={publish}>
                    <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}><Input placeholder="大理" /></Form.Item>
                    <Form.Item name="departDate" label="出发时间" rules={[{ required: true, message: '请选择出发时间' }]}><DatePicker /></Form.Item>
                    <Form.Item name="days" label="行程天数" rules={[{ required: true, message: '请输入行程天数' }]}><InputNumber min={1} max={60} /></Form.Item>
                    <Form.Item name="budgetMin" label="预算下限"><InputNumber min={0} precision={2} /></Form.Item>
                    <Form.Item name="budgetMax" label="预算上限"><InputNumber min={0} precision={2} /></Form.Item>
                    <Form.Item name="transport" label="出行方式" rules={[{ required: true, message: '请选择出行方式' }]}>
                      <Select options={['自驾', '公共交通', '徒步'].map(value => ({ value }))} />
                    </Form.Item>
                    <Form.Item name="companionCount" label="期望旅伴人数"><InputNumber min={1} max={20} /></Form.Item>
                    <Form.Item name="genderPreference" label="性别偏好"><Select allowClear options={['不限', '男', '女'].map(value => ({ value }))} /></Form.Item>
                    <Button type="primary" htmlType="submit">发布计划</Button>
                  </Form>
                </Card>
              )
            },
            {
              key: 'match',
              label: '智能匹配',
              children: (
                <Row gutter={16}>
                  {trips.map(trip => (
                    <Col span={12} key={trip.id} style={{ marginBottom: 16 }}>
                      <Card title={<><EnvironmentOutlined /> {trip.destination}</>} extra={<Tag>{trip.status}</Tag>}>
                        <p>{trip.departDate} / {trip.days} 天 / {trip.transport}</p>
                        <p>预算：{trip.budgetMin ?? '—'} ~ {trip.budgetMax ?? '—'}</p>
                        <Button onClick={() => joinTrip(trip.id)}>申请加入</Button>
                      </Card>
                    </Col>
                  ))}
                  {trips.length === 0 && <Col span={24}><Card>暂无行程，请先在「发布行程」中创建。</Card></Col>}
                </Row>
              )
            },
            {
              key: 'board',
              label: '协作看板',
              children: <Card title="每日安排"><List dataSource={['Day 1 抵达与集合', 'Day 2 环洱海', 'Day 3 沙溪古镇']} renderItem={item => <List.Item>{item}</List.Item>} /></Card>
            },
            {
              key: 'settlement',
              label: '费用清算',
              children: <SettlementPage user={user} trips={trips} />
            },
            {
              key: 'chat',
              label: '即时沟通',
              children: <Card title={<><MessageOutlined /> 行程群聊</>}><List dataSource={messages} renderItem={item => <List.Item>{item}</List.Item>} /><Button onClick={send}>发送示例消息</Button></Card>
            }
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
