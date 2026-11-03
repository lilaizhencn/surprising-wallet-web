import { useEffect, useState } from 'react';
import { Alert, App, Button, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { approvalRequest, ApprovalApiError } from '../approval/client';
import { ApprovalActivationForm } from '../approval/ApprovalActivationForm';
import { useSession } from '../auth/session';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import type { PageResponse } from '../types/pagination';

type Intent = {
  id: string; businessReference: string; chain: string; network: string; assetSymbol: string;
  amount: string; recipient: string; maximumNetworkFee: string; source: string; subject: string;
  initiatorId: string; externalReference: string; fundingSource: string;
};
type Approval = {
  intent: Intent; intentHash: string; status: string; reasons: string[]; requiredReviewers: number;
  policyVersion: number; expiresAt: string; signingStarted: boolean;
  assetSnapshot: { networkIdentity: string; tokenIdentifier: string | null; nativeSymbol: string };
};
type Decision = 'APPROVE' | 'REJECT';

type DecisionFields = { reason: string; password: string };

export default function ApprovalPage() {
  const { t } = useI18n();
  const { message } = App.useApp();
  const session = useSession();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const [selected, setSelected] = useState<Approval>();
  const [decision, setDecision] = useState<Decision>();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<DecisionFields>();
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [activationToken, setActivationToken] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('activate');
    return value && /^[0-9a-f]{64}$/.test(value) ? value : undefined;
  });
  const query = useApiQuery(signal => apiRequest<PageResponse<Approval>>(
    `/custody/console/v1/approvals/authority?status=${status}&limit=${page.pageSize}&offset=${(page.current - 1) * page.pageSize}`,
    { signal, cache: 'no-store' },
  ), [status, page.current, page.pageSize, session?.tenantId, session?.userId]);
  useEffect(() => {
    if (activationToken) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') query.refetch(); }, 5000);
    return () => window.clearInterval(timer);
  }, [activationToken, query.refetch]);
  useEffect(() => {
    if (query.data) setSubmitted(current => current.filter(id => query.data?.items.some(row => row.intent.id === id && row.status === 'PENDING')));
  }, [query.data]);
  useEffect(() => {
    if (selected && query.data) {
      const current=query.data.items.find(row => row.intent.id === selected.intent.id);
      if (current) setSelected(current);
    }
  }, [query.data, selected?.intent.id]);
  const close = () => { setSelected(undefined); setDecision(undefined); form.resetFields(); };
  const canReview = selected?.status === 'PENDING'
    && !selected.signingStarted && new Date(selected.expiresAt).getTime() > Date.now()
    && !(selected.intent.source === 'CONSOLE' && selected.intent.initiatorId === session?.userId)
    && !submitted.includes(selected.intent.id);
  const submit = async ({ reason, password }: DecisionFields) => {
    if (!selected || !decision || !canReview || !session?.tenantId || !session.userId) return;
    setBusy(true);
    try {
      const result = await approvalRequest<{ status: string }>(`/requests/${selected.intent.id}/decisions/step-up`, {
        method: 'POST', body: { tenantId: session.tenantId, memberId: session.userId, password, decision, reason, intentHash: selected.intentHash },
      });
      setSubmitted(current => [...current, selected.intent.id]);
      close(); query.refetch();
      void message.success(t(result.status === 'EXPIRED' ? 'Approval expired; no decision was accepted.' : 'Decision recorded'));
    } catch (error) {
      form.setFieldValue('password', '');
      void message.error(error instanceof ApprovalApiError && error.status === 401
        ? t('Approval password is incorrect or has not been set.') : t('Unable to record decision'));
    } finally { setBusy(false); }
  };
  const title = t('Withdrawal approvals');
  if (activationToken) return <div className="page-stack">
    <PageHeader title={title} />
    <ApprovalActivationForm token={activationToken} onComplete={() => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setActivationToken(undefined);
      void message.success(t('Approval password set.'));
    }} />
  </div>;
  return <div className="page-stack">
    <PageHeader title={title} description={t('View all tenant withdrawal requests and their current approval status.')} actions={<Space>
      {session?.role === 'TENANT_ADMIN' && <Link to="/console/approval-settings"><Button>{t('Approval settings')}</Button></Link>}
      <Button onClick={query.refetch}>{t('Refresh')}</Button>
    </Space>} />
    <Space wrap style={{ marginBottom: 16 }}>
      <Select aria-label={t('Status')} value={status} style={{ minWidth: 180 }} onChange={value => { setStatus(value); setPage(current => ({ ...current, current: 1 })); }}
        options={['', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].map(value => ({ value, label: t(value || 'All') }))} />
      <Typography.Text type="secondary">{t('Updates automatically every 5 seconds')}</Typography.Text>
    </Space>
    {query.error && <Alert type="error" title={t('Unable to load approvals')} action={<Button onClick={query.refetch}>{t('Retry')}</Button>} />}
    <Table<Approval> rowKey={row => row.intent.id} loading={query.loading} dataSource={query.data?.items ?? []} scroll={{ x: 1000 }}
      pagination={{ ...page, total: query.data?.total ?? 0, onChange: (current, pageSize) => setPage({ current, pageSize }) }} columns={[
        { title: t('Order'), render: (_, row) => row.intent.businessReference },
        { title: t('Chain'), render: (_, row) => `${row.intent.chain} / ${row.intent.network}` },
        { title: t('Amount'), render: (_, row) => `${row.intent.amount} ${row.intent.assetSymbol}` },
        { title: t('Recipient'), render: (_, row) => <Typography.Text copyable>{row.intent.recipient}</Typography.Text> },
        { title: t('Status'), render: (_, row) => submitted.includes(row.intent.id) && row.status === 'PENDING' ? t('Decision submitted; updating status') : t(row.status) },
        { title: t('Actions'), render: (_, row) => <Button onClick={() => { setSelected(row); setDecision(undefined); form.resetFields(); }}>{t('Details')}</Button> },
      ]} />
    <Modal title={t('Review withdrawal')} open={Boolean(selected)} footer={null} width={820} onCancel={close} destroyOnHidden>
      {selected && <>
        <Descriptions column={1} size="small" items={[
          { key: 'order', label: t('Order'), children: selected.intent.businessReference },
          { key: 'status', label: t('Status'), children: <Tag>{t(selected.status)}</Tag> },
          { key: 'chain', label: t('Chain'), children: `${selected.intent.chain} / ${selected.intent.network}` },
          { key: 'amount', label: t('Amount'), children: `${selected.intent.amount} ${selected.intent.assetSymbol}` },
          { key: 'recipient', label: t('Recipient'), children: <Typography.Text copyable>{selected.intent.recipient}</Typography.Text> },
          { key: 'fee', label: t('Maximum network fee'), children: `${selected.intent.maximumNetworkFee} ${selected.assetSnapshot.nativeSymbol}` },
          { key: 'source', label: t('Source'), children: selected.intent.source },
          { key: 'reference', label: t('External reference'), children: selected.intent.externalReference || '—' },
          { key: 'subject', label: t('Subject'), children: selected.intent.subject || '—' },
          { key: 'funding', label: t('Funding source'), children: selected.intent.fundingSource || '—' },
          { key: 'reasons', label: t('Approval reasons'), children: selected.reasons.map(reason => t(reason)).join(', ') || '—' },
          { key: 'reviewers', label: t('Required reviewers'), children: selected.requiredReviewers },
          { key: 'expiry', label: t('Expires at'), children: selected.expiresAt },
          { key: 'hash', label: t('Intent hash'), children: selected.intentHash ? <Typography.Text copyable>{selected.intentHash}</Typography.Text> : '—' },
          { key: 'withdrawalId', label: t('Withdrawal ID'), children: <Typography.Text copyable>{selected.intent.id}</Typography.Text> },
        ]} />
        {canReview && !decision && <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => setDecision('APPROVE')}>{t('Approve')}</Button>
          <Button danger onClick={() => setDecision('REJECT')}>{t('Reject')}</Button>
        </Space>}
        {canReview && decision && <Form form={form} layout="vertical" preserve={false} onFinish={submit} style={{ marginTop: 16 }}>
          <Alert type="info" title={t(decision === 'APPROVE' ? 'Confirm approval' : 'Confirm rejection')} description={t('Enter your own approval password for this decision.')} style={{ marginBottom: 16 }} />
          <Form.Item name="reason" label={t('Reason')} rules={[{ required: true, whitespace: true, max: 1000 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="password" label={t('Approval password')} rules={[{ required: true }]}><Input.Password autoComplete="off" /></Form.Item>
          <Space><Button onClick={() => { setDecision(undefined); form.resetFields(); }}>{t('Back')}</Button>
            <Button type="primary" danger={decision === 'REJECT'} htmlType="submit" loading={busy}>{t('Record decision')}</Button></Space>
        </Form>}
        {!canReview && <Alert type="info" title={t('This request cannot be reviewed by the current account.')} style={{ marginTop: 16 }} />}
      </>}
    </Modal>
  </div>;
}
