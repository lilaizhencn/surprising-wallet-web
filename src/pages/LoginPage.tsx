import { useState } from 'react';
import { Alert, App, Button, Form, Input, QRCode, Segmented, Space, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { clearSession, saveSession, type AccountType, type Session } from '../auth/session';
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
  verificationRequired?: boolean;
  emailRequired?: boolean;
  emailVerified?: boolean;
  totpRequired?: boolean;
  totpSetupRequired?: boolean;
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
  const [pending, setPending] = useState<LoginResponse>();
  const [setup, setSetup] = useState<{ secret: string; uri: string; expiresAt: string }>();
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();

  const complete = (result: LoginResponse) => {
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
  };
  const securityAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try { await action(); } catch (error) { void message.error(t(error instanceof Error ? error.message : 'Unable to verify sign in')); }
    finally { setLoading(false); }
  };
  const verify = (fields: { emailCode?: string; totpCode?: string }) => securityAction(async () => {
    const result = await apiRequest<LoginResponse>('/custody/console/v1/auth/verify', { method: 'POST', body: fields });
    if (result.verificationRequired) setPending(result); else complete(result);
  });

  const submit = async (values: LoginValues) => {
    setLoading(true);
    try {
      const path = accountType === 'platform'
        ? '/custody/platform/v1/auth/login'
        : '/custody/console/v1/auth/login';
      const body = { email: values.email, password: values.password };
      const result = await apiRequest<LoginResponse>(path, { method: 'POST', body });
      if (result.verificationRequired) { clearSession(); setPending(result); setSetup(undefined); setSent(false); }
      else complete(result);
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
          {pending ? <>
            <Alert type="info" title={t('Complete sign-in verification')} description={t('Verification expires after 5 minutes. Business access stays locked until all required checks pass.')} />
            <Typography.Paragraph>{pending.email}</Typography.Paragraph>
            {pending.emailRequired && !pending.emailVerified ? <Button disabled={loading} onClick={() => void securityAction(async () => {
              await apiRequest('/custody/console/v1/auth/email-code', { method: 'POST' }); setSent(true);
              void message.success(t('Verification code sent. Wait 60 seconds before resending.'));
            })}>{t(sent ? 'Resend email code' : 'Send email code')}</Button> : pending.totpSetupRequired && <>
              <p>{t('Your administrator requires Google Authenticator. Scan the QR code and enter the generated code to bind your account.')}</p>
              {!setup ? <Button disabled={loading} onClick={() => void securityAction(async () => setSetup(await apiRequest('/custody/console/v1/auth/totp/setup', { method: 'POST' }))) }>{t('Show binding QR code')}</Button>
                : <Space orientation="vertical"><QRCode value={setup.uri} /><Typography.Text copyable>{setup.secret}</Typography.Text><Typography.Text type="secondary">{t('Keep this secret private. The QR code expires in 5 minutes.')}</Typography.Text></Space>}
            </>}
            <Form key={pending.emailVerified ? 'totp' : 'email'} layout="vertical" onFinish={verify} preserve={false}>
              {pending.emailRequired && !pending.emailVerified ? <Form.Item name="emailCode" label={t('Email verification code')} rules={[{ required: true, pattern: /^[0-9]{6}$/ }]}><Input autoComplete="one-time-code" inputMode="numeric" maxLength={6} /></Form.Item>
                : <Form.Item name="totpCode" label={t('Authenticator code')} rules={[{ required: true, pattern: /^[0-9]{6}$/ }]}><Input autoComplete="one-time-code" inputMode="numeric" maxLength={6} /></Form.Item>}
              <Button aria-label={t('Verify and continue')} type="primary" htmlType="submit" loading={loading}>{t('Verify and continue')}</Button>
            </Form>
            <Button type="link" disabled={loading} onClick={() => { setPending(undefined); setSetup(undefined); setSent(false); }}>{t('Back to sign in')}</Button>
          </> : <><Segmented<AccountType>
            disabled={loading}
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
          </Form></>}
        </div>
      </div>
    </main>
  );
}
