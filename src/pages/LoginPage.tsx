import { useState } from 'react';
import { App, Button, Form, Input, Segmented } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { saveSession, type AccountType, type Session } from '../auth/session';
import { Brand } from '../components/Brand';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useI18n } from '../i18n';

type LoginResponse = {
  expiresAt: string;
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  email: string;
  displayName: string;
  role: string;
  scopes: string[];
};

type LoginValues = {
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
  const { t } = useI18n();

  const submit = async (values: LoginValues) => {
    setLoading(true);
    try {
      const path = accountType === 'platform'
        ? '/custody/platform/v1/auth/login'
        : '/custody/console/v1/auth/login';
      const body = { email: values.email, password: values.password };
      const result = await apiRequest<LoginResponse>(path, { method: 'POST', body });
      const session: Session = { version: 2, accountType, ...result };
      saveSession(session);
      void message.success(t('Welcome back'));
      const requestedPath = (location.state as { from?: string } | null)?.from;
      const destination = requestedPath
        && (accountType === 'platform'
          ? requestedPath.startsWith('/platform/')
          : requestedPath.startsWith('/console/'))
        ? requestedPath
        : accountType === 'platform' ? '/platform/tenants' : '/console/overview';
      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-brand-area">
        <div className="login-brand-row"><Brand /><LanguageSwitch /></div>
        <div>
          <h1>{t('Operate custody infrastructure with a complete audit path.')}</h1>
          <p>
            {t('Manage isolated tenants, deposit addresses, signed webhooks, service credentials, and chain activity from one console.')}
          </p>
        </div>
        <Link to="/"><ArrowLeftOutlined /> {t('Back to product')}</Link>
      </div>
      <div className="login-form-area">
        <div className="login-form-shell">
          <h2>{t('Sign in')}</h2>
          <p>{t('Use the credentials created for your Console account.')}</p>
          <Segmented<AccountType>
            block
            value={accountType}
            options={[
              { value: 'tenant', label: t('Tenant Console') },
              { value: 'platform', label: t('Platform admin') },
            ]}
            onChange={setAccountType}
          />
          <Form<LoginValues> layout="vertical" requiredMark={false} onFinish={submit}>
            <Form.Item
              name="email"
              label={t('Email')}
              rules={[
                { required: true, message: t('Enter your email') },
                { type: 'email', message: t('Enter a valid email') },
              ]}
            >
              <Input prefix={<MailOutlined />} autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('Password')}
              rules={[{ required: true, message: t('Enter your password') }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {t('Sign in')}
            </Button>
          </Form>
        </div>
      </div>
    </main>
  );
}
