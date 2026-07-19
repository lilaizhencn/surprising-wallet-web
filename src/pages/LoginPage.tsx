import { useState } from 'react';
import { App, Button, Form, Input, Segmented } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { saveSession, type AccountType, type Session } from '../auth/session';
import { Brand } from '../components/Brand';

type LoginResponse = {
  token: string;
  expiresAt: string;
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  email: string;
  displayName: string;
  role: string;
};

type LoginValues = {
  tenantSlug?: string;
  email: string;
  password: string;
};

export default function LoginPage() {
  const location = useLocation();
  const requestedType = (location.state as { accountType?: AccountType } | null)?.accountType;
  const [accountType, setAccountType] = useState<AccountType>(requestedType ?? 'tenant');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const submit = async (values: LoginValues) => {
    setLoading(true);
    try {
      const path = accountType === 'platform'
        ? '/custody/platform/v1/auth/login'
        : '/custody/console/v1/auth/login';
      const body = accountType === 'platform'
        ? { email: values.email, password: values.password }
        : values;
      const result = await apiRequest<LoginResponse>(path, { method: 'POST', body });
      const session: Session = { version: 1, accountType, ...result };
      saveSession(session);
      void message.success('Welcome back');
      navigate(accountType === 'platform' ? '/platform/tenants' : '/console/overview', {
        replace: true,
      });
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-brand-area">
        <Brand />
        <div>
          <h1>Operate custody infrastructure with a complete audit path.</h1>
          <p>
            Manage isolated tenants, deposit addresses, signed webhooks, service
            credentials, and chain activity from one console.
          </p>
        </div>
        <Link to="/"><ArrowLeftOutlined /> Back to product</Link>
      </div>
      <div className="login-form-area">
        <div className="login-form-shell">
          <h2>Sign in</h2>
          <p>Use the credentials created for your Console account.</p>
          <Segmented<AccountType>
            block
            value={accountType}
            options={[
              { value: 'tenant', label: 'Tenant Console' },
              { value: 'platform', label: 'Platform admin' },
            ]}
            onChange={setAccountType}
          />
          <Form<LoginValues> layout="vertical" requiredMark={false} onFinish={submit}>
            {accountType === 'tenant' ? (
              <Form.Item
                name="tenantSlug"
                label="Tenant slug"
                rules={[{ required: true, message: 'Enter your tenant slug' }]}
              >
                <Input autoComplete="organization" placeholder="acme-pay" />
              </Form.Item>
            ) : null}
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Enter your email' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
            >
              <Input prefix={<MailOutlined />} autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Enter your password' }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Sign in
            </Button>
          </Form>
        </div>
      </div>
    </main>
  );
}
