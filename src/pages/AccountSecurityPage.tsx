import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Form, Input, QRCode, Space, Switch, Typography } from 'antd';
import { apiRequest } from '../api/client';
import { useApiQuery } from '../hooks/useApiQuery';
import { clearSession, useSession } from '../auth/session';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';
import type { AccountSecurity, TotpSetup } from '../security/types';

export default function AccountSecurityPage() {
  const { t } = useI18n(); const { message, modal } = App.useApp(); const session = useSession(); const navigate = useNavigate();
  const [passwordForm] = Form.useForm<{ password: string }>();
  const [busy, setBusy] = useState(false); const [setup, setSetup] = useState<TotpSetup>();
  const query = useApiQuery(signal => apiRequest<AccountSecurity>('/custody/console/v1/account-security', { signal, cache: 'no-store' }), [session?.userId]);
  const run = async (work: () => Promise<void>) => { setBusy(true); try { await work(); } catch(e) { void message.error(t(e instanceof Error ? e.message : 'Unable to save account security')); } finally { setBusy(false); } };
  const changePolicy = (emailRequired: boolean, totpRequired: boolean) => modal.confirm({ title: t('Change login requirements?'), content: t('All sessions will be revoked. Sign in again to complete the new verification requirements.'), onOk: async () => {
    await apiRequest(`/custody/console/v1/users/${session?.userId}/login-policy`, { method: 'PUT', body: { emailRequired, totpRequired } }); clearSession(); navigate('/console/login', { replace: true });
  } });
  return <>
    <PageHeader title={t('Account security')} description={t('Manage your sign-in verification and authenticator binding.')} />
    {query.error && <Alert type="error" title={t(query.error)} action={<Button onClick={query.refetch}>{t('Retry')}</Button>} />}
    <Card loading={query.loading}>
      {query.data && <>
        <Descriptions column={1} items={[
          { key: 'email', label: t('Email'), children: session?.email },
          { key: 'emailRequired', label: t('Require email verification'), children: t(query.data.emailRequired ? 'Enabled' : 'Disabled') },
          { key: 'totpRequired', label: t('Require Google Authenticator'), children: t(query.data.totpRequired ? 'Enabled' : 'Disabled') },
          { key: 'bound', label: t('Authenticator binding'), children: t(query.data.totpBound ? 'Bound' : 'Not bound') },
        ]} />
        {!query.data.emailDeliveryConfigured && <Alert type="info" title={t('Email delivery is not configured. Email verification cannot be enabled yet.')} />}
        {session?.role === 'TENANT_ADMIN' && <Space wrap style={{ margin: '16px 0' }}>
          <span>{t('Require email verification')} <Switch aria-label={t('Require email verification')} checked={query.data.emailRequired} disabled={!query.data.emailDeliveryConfigured && !query.data.emailRequired} onChange={v => changePolicy(v, query.data!.totpRequired)} /></span>
          <span>{t('Require Google Authenticator')} <Switch aria-label={t('Require Google Authenticator')} checked={query.data.totpRequired} onChange={v => changePolicy(query.data!.emailRequired, v)} /></span>
        </Space>}
        {!query.data.totpBound ? <>
          <Form key="setup-password" form={passwordForm} layout="vertical" onFinish={(values: { password: string }) => void run(async () => { setSetup(await apiRequest<TotpSetup>('/custody/console/v1/account-security/totp/setup', { method: 'POST', body: values })); passwordForm.resetFields(); })} preserve={false}>
            <Form.Item name="password" label={t('Current password')} rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
            <Button htmlType="submit" loading={busy}>{t('Show binding QR code')}</Button>
          </Form>
          {setup && <Space orientation="vertical" style={{ marginTop: 16 }}>
            <QRCode value={setup.uri} /><Typography.Text copyable>{setup.secret}</Typography.Text>
            <Typography.Text type="secondary">{t('Keep this secret private. The QR code expires in 5 minutes.')}</Typography.Text>
            <Form layout="vertical" onFinish={(values: { code: string }) => void run(async () => {
              await apiRequest('/custody/console/v1/account-security/totp/confirm', { method: 'POST', body: values }); setSetup(undefined); query.refetch(); void message.success(t('Authenticator bound'));
            })} preserve={false}>
              <Form.Item name="code" label={t('Authenticator code')} rules={[{ required: true, pattern: /^[0-9]{6}$/ }]}><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></Form.Item>
              <Button type="primary" htmlType="submit" loading={busy}>{t('Confirm binding')}</Button>
            </Form>
          </Space>}
        </> : query.data.totpRequired ? <Alert type="info" title={t('Your administrator requires an authenticator. Contact them if you lose access.')} /> : <Form key="unbind" layout="vertical" preserve={false} onFinish={(values: { password: string; code: string }) => void run(async () => {
          await apiRequest('/custody/console/v1/account-security/totp/unbind', { method: 'POST', body: values }); query.refetch(); void message.success(t('Authenticator unbound'));
        })}>
          <Form.Item name="password" label={t('Current password')} rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Form.Item name="code" label={t('Authenticator code')} rules={[{ required: true, pattern: /^[0-9]{6}$/ }]}><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></Form.Item>
          <Button danger htmlType="submit" loading={busy}>{t('Unbind authenticator')}</Button>
        </Form>}
      </>}
    </Card>
  </>;
}
