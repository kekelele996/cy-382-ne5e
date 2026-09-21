import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Layout,
  List,
  Row,
  Select,
  Statistic,
  Tabs,
  message
} from 'antd';
import { EnvironmentOutlined, MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from './api';
import AuthBar from './components/AuthBar';
import SettlementWorkspace from './components/SettlementWorkspace';
import type { Trip, UserInfo } from './types';

const demoTrips = [
  { destination: '大理', departDate: '2026-07-12', days: 5, budget: '3500-5200', transport: '公共交通', score: 96 },
  { destination: '青海湖', departDate: '2026-08-03', days: 7, budget: '4800-6800', transport: '自驾', score: 88 }
];

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState(['系统：已进入大理行程协作空间']);
  const socket = useMemo(() => io('/', { path: '/socket.io' }), []);

  useEffect(() => {
    if (!getToken()) return;
    api<UserInfo>('/users/me')
      .then(setUser)
      .catch(() => undefined);
  }, []);

  const send = () => {
    socket.emit('trip-message', { tripId: 1, sender: user?.nickname ?? '我', content: '今晚确认民宿地址', type: 'text' });
    setMessages(items => [...items, `${user?.nickname ?? '我'}：今晚确认民宿地址`]);
  };

  const publish = async (values: any) => {
    try {
      const trip = await api<Trip>('/trips', {
        method: 'POST',
        body: JSON.stringify({
          destination: values.destination,
          departDate: values.departDate.format('YYYY-MM-DD'),
          days: values.days,
          budgetMax: values.budgetMax,
          budgetMin: values.budgetMin,
          transport: values.transport,
          companionCount: values.companionCount ?? 1
        })
      });
      message.success(`行程「${trip.destination}」已发布（#${trip.id}），你已自动成为成员`);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  return (
    <Layout className="shell">
      <Layout.Sider width={240} className="side">
        <h1>旅伴匹配</h1>
        <p>TripMatch</p>
      </Layout.Sider>
      <Layout.Content className="content">
        <div style={{ marginBottom: 8 }}>
          <AuthBar user={user} onAuthChange={setUser} />
        </div>
        <Tabs
          items={[
            {
              key: 'publish',
              label: '发布行程',
              children: (
                <Card>
                  {!user ? (
                    <p>请先登录后再发布行程。</p>
                  ) : (
                    <Form
                      layout="vertical"
                      className="form"
                      initialValues={{ destination: '大理', departDate: dayjs('2026-07-12'), days: 5, budgetMax: 5200, transport: '公共交通' }}
                      onFinish={publish}
                    >
                      <Row gutter={16}>
                        <Col span={8}><Form.Item label="目的地" name="destination"><Input /></Form.Item></Col>
                        <Col span={8}><Form.Item label="出发时间" name="departDate"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item label="行程天数" name="days"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item label="预算下限" name="budgetMin"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item label="预算上限" name="budgetMax"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}>
                          <Form.Item label="出行方式" name="transport">
                            <Select options={['自驾', '公共交通', '徒步'].map(v => ({ value: v, label: v }))} />
                          </Form.Item>
                        </Col>
                        <Col span={8}><Form.Item label="期望旅伴人数" name="companionCount"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                      </Row>
                      <Button type="primary" htmlType="submit">发布计划</Button>
                    </Form>
                  )}
                </Card>
              )
            },
            {
              key: 'match',
              label: '智能匹配',
              children: (
                <Row gutter={16}>
                  {demoTrips.map(trip => (
                    <Col span={12} key={trip.destination}>
                      <Card title={<><EnvironmentOutlined /> {trip.destination}</>}>
                        <p>{trip.departDate} / {trip.days} 天 / {trip.transport} / 预算 {trip.budget}</p>
                        <Statistic title="匹配度" value={trip.score} suffix="%" />
                        <Button style={{ marginTop: 8 }} disabled={!user} onClick={async () => {
                          message.info('演示数据：匹配申请功能略');
                        }}>申请加入</Button>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )
            },
            {
              key: 'expense',
              label: '费用清算',
              children: user ? (
                <SettlementWorkspace user={user} />
              ) : (
                <Card><p>请先登录后使用费用清算：登记本人垫付、互相确认、生成零和清算单。</p></Card>
              )
            },
            {
              key: 'board',
              label: '协作看板',
              children: (
                <Card title="每日安排">
                  <List dataSource={['Day 1 抵达与集合', 'Day 2 环洱海', 'Day 3 沙溪古镇']} renderItem={item => <List.Item>{item}</List.Item>} />
                </Card>
              )
            },
            {
              key: 'chat',
              label: '即时沟通',
              children: (
                <Card title={<><MessageOutlined /> 行程群聊</>}>
                  <List dataSource={messages} renderItem={item => <List.Item>{item}</List.Item>} />
                  <Button onClick={send}>发送示例消息</Button>
                </Card>
              )
            }
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
