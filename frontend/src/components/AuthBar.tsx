import { useState } from 'react';
import { Button, Form, Input, Modal, Space, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api, setToken } from '../api';
import type { AuthResult, UserInfo } from '../types';

interface Props {
  user: UserInfo | null;
  onAuthChange: (user: UserInfo | null) => void;
}

export default function AuthBar({ user, onAuthChange }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const submit = async (values: { email: string; nickname?: string; password: string }) => {
    setLoading(true);
    try {
      const path = mode === 'login' ? '/users/login' : '/users/register';
      const result = await api<AuthResult>(path, { method: 'POST', body: JSON.stringify(values) });
      setToken(result.token);
      onAuthChange(result.user);
      setOpen(false);
      message.success(mode === 'login' ? `欢迎回来，${result.user.nickname}` : `注册成功，${result.user.nickname}`);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    onAuthChange(null);
    message.info('已退出登录');
  };

  return (
    <Space style={{ float: 'right' }}>
      {user ? (
        <>
          <Typography.Text strong><UserOutlined /> {user.nickname}</Typography.Text>
          <Button size="small" onClick={logout}>退出</Button>
        </>
      ) : (
        <>
          <Button type="link" onClick={() => { setMode('login'); setOpen(true); }}>登录</Button>
          <Button type="primary" size="small" onClick={() => { setMode('register'); setOpen(true); }}>注册</Button>
        </>
      )}
      <Modal
        title={mode === 'login' ? '登录 TripMatch' : '注册新账号'}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={submit}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="you@example.com" />
          </Form.Item>
          {mode === 'register' && (
            <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder="旅途中的称呼" />
            </Form.Item>
          )}
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>{mode === 'login' ? '登录' : '注册并登录'}</Button>
            <Button type="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
            </Button>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
