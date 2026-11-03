import { useState } from 'react';
import { Alert, Button, Card, Form, Input } from 'antd';
import { approvalRequest } from './client';
import { useI18n } from '../i18n';

export function ApprovalActivationForm({ token, onComplete }: { token: string; onComplete: () => void }) {
  const { t } = useI18n(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const activate = async ({ password }: { password: string }) => {
    setBusy(true); setError('');
    try { await approvalRequest('/auth/activate', { method: 'POST', body: { token, password } }); onComplete(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('Unable to activate approval account')); }
    finally { setBusy(false); }
  };
  return <Card title={t('Activate independent approval account')} style={{ maxWidth: 520 }}>
    <p>{t('Set your own short approval password before reviewing withdrawals.')}</p>
    {error && <Alert type="error" title={error} />}
    <Form layout="vertical" onFinish={activate} preserve={false}>
      <Form.Item name="password" label={t('New independent password')} rules={[{ required: true, min: 8, max: 32 }]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item name="confirmPassword" label={t('Confirm password')} dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) {
        return !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error(t('Passwords do not match')));
      } })]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>{t('Activate account')}</Button>
    </Form>
  </Card>;
}
