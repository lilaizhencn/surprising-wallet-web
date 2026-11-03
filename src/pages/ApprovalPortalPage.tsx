import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { approvalOrigin } from '../approval/origin';
import { approvalRequest, ApprovalApiError } from '../approval/client';
import { useApprovalPolling } from '../approval/useApprovalPolling';
import { ApprovalMembersPanel, ApprovalAuditPanel } from '../approval/ApprovalMembersPanel';
import { ApprovalActivationForm } from '../approval/ApprovalActivationForm';
import { useSession } from '../auth/session';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../i18n';

type Principal = { tenantId: string; memberId: string; displayName: string; role: string; email: string; csrfToken: string };
type Intent = { id: string; chain: string; network: string; assetSymbol: string; recipient: string; amount: string; maximumNetworkFee: string; source: string; subject: string; businessReference: string; initiatorId: string; externalReference: string; fundingSource: string };
type Request = { assetSnapshot: { networkIdentity: string; tokenIdentifier: string | null; nativeSymbol: string }; intent: Intent; intentHash: string; status: string; reasons: string[]; requiredReviewers: number; policyVersion: number; expiresAt: string; signingStarted: boolean };
type DecisionHistory = { reviewerId: string; decision: string; reason: string; createdAt: string };
type Page = { items: Request[]; total: number; limit: number; offset: number };
type Policy = { chain: string; network: string; assetSymbol: string; version: number; singleAmount: string | null; rolling24hAmount: string | null; allWithdrawals: boolean; newRecipient: boolean; consoleWithdrawal: boolean; requiredReviewers: number; expirySeconds: number };
type PolicyFields = Omit<Policy, 'version'>;

export default function ApprovalPortalPage() {
  const { t } = useI18n(); const { message } = App.useApp();
  const walletSession = useSession();
  const trustedSite = approvalOrigin() === window.location.origin;
  const [principal, setPrincipal] = useState<Principal>();
  const [activationToken, setActivationToken] = useState<string | undefined>(() => {
    const token = trustedSite ? new URLSearchParams(window.location.hash.slice(1)).get('activate') : null;
    return token && /^[0-9a-f]{64}$/.test(token) ? token : undefined;
  });
  const activationCompleted = useRef(false);
  const [checking, setChecking] = useState(true); const [loginError, setLoginError] = useState(''); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [revision, setRevision] = useState(0); const [selected, setSelected] = useState<Request>(); const [decision, setDecision] = useState('APPROVE');
  const [history, setHistory] = useState<DecisionHistory[]>([]); const [historyError, setHistoryError] = useState(''); const [historyLoading, setHistoryLoading] = useState(false);
  const historyVersion = useRef(0);
  const [decisionForm] = Form.useForm<{ reason: string; password: string }>(); const [policyForm] = Form.useForm<PolicyFields>();
  const identityVersion = useRef(0); const policyAbort = useRef<AbortController | undefined>(undefined);
  const [policies, setPolicies] = useState<Policy[]>([]); const [editingPolicy, setEditingPolicy] = useState<Policy>(); const [policyOpen, setPolicyOpen] = useState(false);
  const clearIdentity = useCallback(() => {
    identityVersion.current++; historyVersion.current++; setHistory([]); setHistoryError(''); policyAbort.current?.abort(); policyAbort.current = undefined; setBusy(false);
    setPrincipal(undefined); setSelected(undefined); setPolicies([]); setEditingPolicy(undefined); setPolicyOpen(false);
    setStatus(''); setPagination({ current: 1, pageSize: 20 }); decisionForm.resetFields(); policyForm.resetFields();
  }, [decisionForm, policyForm]);
  const expired = useCallback(() => { clearIdentity(); setLoginError(t('Independent approval session expired. Please sign in again.')); }, [clearIdentity, t]);
  useEffect(() => {
    if (principal && (principal.tenantId !== walletSession?.tenantId || principal.memberId !== walletSession.userId)) clearIdentity();
  }, [principal, walletSession?.tenantId, walletSession?.userId, clearIdentity]);
  const linkedPrincipal = useCallback(async (candidate: Principal) => {
    if (candidate.tenantId === walletSession?.tenantId && candidate.memberId === walletSession.userId) return candidate;
    await approvalRequest('/auth/logout', { method: 'POST', csrf: candidate.csrfToken }).catch(() => undefined);
    throw new Error(t('Use the approval account linked to your current wallet account.'));
  }, [walletSession?.tenantId, walletSession?.userId, t]);
  useEffect(() => { if (!trustedSite || activationToken || activationCompleted.current) { setChecking(false); return; } const controller = new AbortController();
    void approvalRequest<Principal>('/auth/session', { signal: controller.signal }).then(linkedPrincipal).then(candidate => {
      if (!controller.signal.aborted) setPrincipal(candidate);
    }).catch(error => {
      if (!controller.signal.aborted && !(error instanceof ApprovalApiError && error.status === 401)) setLoginError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [trustedSite, activationToken, linkedPrincipal]);
  const load = useCallback((signal: AbortSignal) => approvalRequest<Page>(`/requests?status=${status}&limit=${pagination.pageSize}&offset=${(pagination.current - 1) * pagination.pageSize}`, { signal }), [status, pagination]);
  const rows = useApprovalPolling(load, expired, Boolean(principal), revision);
  const login = async (fields: { email: string; password: string }) => { setBusy(true); setLoginError('');
    try { setPrincipal(await linkedPrincipal(await approvalRequest<Principal>('/auth/login', { method: 'POST', body: fields }))); }
    catch (error) { setLoginError(error instanceof Error ? error.message : t('Unable to sign in')); } finally { setBusy(false); }
  };
  const logout = async () => { try { await approvalRequest('/auth/logout', { method: 'POST', csrf: principal?.csrfToken }); clearIdentity(); setLoginError(''); }
    catch (error) { void message.error(error instanceof Error ? error.message : t('Unable to sign out')); } };
  const inspect = async (row: Request) => {
    setSelected(row); setDecision('APPROVE'); decisionForm.resetFields(); setHistory([]); setHistoryError(''); setHistoryLoading(true);
    const identity = identityVersion.current; const version = ++historyVersion.current;
    try { const data = await approvalRequest<DecisionHistory[]>(`/requests/${row.intent.id}/decisions`); if (identity === identityVersion.current && version === historyVersion.current) setHistory(data); }
    catch(error) { if(identity === identityVersion.current && version === historyVersion.current) { if(error instanceof ApprovalApiError && error.status === 401) expired(); else setHistoryError(error instanceof Error ? error.message : t('Unable to load decision history')); } }
    finally { if(version === historyVersion.current) setHistoryLoading(false); }
  };
  const canReview = selected && selected.status === 'PENDING' && !selected.signingStarted && new Date(selected.expiresAt).getTime() > Date.now()
    && !(selected.intent.source === 'CONSOLE' && selected.intent.initiatorId === principal?.memberId)
    && !history.some(item => item.reviewerId === principal?.memberId) && !historyLoading && !historyError;
  const recordDecision = async ({ reason, password }: { reason: string; password: string }) => { if (!selected || !principal || !canReview) return; const version = identityVersion.current; setBusy(true);
    try { const result = await approvalRequest<Request>(`/requests/${selected.intent.id}/decisions`, { method: 'POST', csrf: principal.csrfToken,
      body: { decision, reason, intentHash: selected.intentHash, password } }); if (version !== identityVersion.current) return; setSelected(undefined); decisionForm.resetFields(); setRevision(n => n + 1);
      void message.success(t(result.status === 'EXPIRED' ? 'Approval expired; no decision was accepted.' : 'Decision recorded')); }
    catch (error) { if (version !== identityVersion.current) return; if (error instanceof ApprovalApiError && error.status === 401) expired(); else void message.error(error instanceof Error ? error.message : t('Unable to record decision')); }
    finally { if (version === identityVersion.current) setBusy(false); }
  };
  useEffect(() => () => { identityVersion.current++; policyAbort.current?.abort(); }, []);
  const loadPolicies = async () => {
    const version = identityVersion.current; const controller = new AbortController(); policyAbort.current?.abort(); policyAbort.current = controller;
    try { const data = await approvalRequest<Policy[]>('/policies', { signal: controller.signal });
      if (!controller.signal.aborted && version === identityVersion.current) setPolicies(data);
    } catch (error) { if (!controller.signal.aborted && version === identityVersion.current) {
      if (error instanceof ApprovalApiError && error.status === 401) expired(); else void message.error(error instanceof Error ? error.message : t('Unable to load policies'));
    } } finally { if (policyAbort.current === controller) policyAbort.current = undefined; }
  };
  const openPolicy = (policy?: Policy) => { setEditingPolicy(policy); policyForm.resetFields(); policyForm.setFieldsValue(policy ?? { allWithdrawals: true, newRecipient: true, consoleWithdrawal: true, requiredReviewers: 1, expirySeconds: 3600 }); setPolicyOpen(true); };
  const savePolicy = async (fields: PolicyFields) => { const version = identityVersion.current; setBusy(true);
    try { await approvalRequest('/policies', { method: 'PUT', csrf: principal?.csrfToken, body: { ...fields, singleAmount: fields.singleAmount || null,
      rolling24hAmount: fields.rolling24hAmount || null, expectedVersion: editingPolicy?.version ?? 0 } }); if (version !== identityVersion.current) return; setPolicyOpen(false); await loadPolicies(); }
    catch (error) { if (version !== identityVersion.current) return; if (error instanceof ApprovalApiError && error.status === 401) expired(); else void message.error(error instanceof Error ? error.message : t('Unable to save policy')); } finally { if (version === identityVersion.current) setBusy(false); }
  };
  const decimal = { pattern: /^(?:0|[1-9]\d{0,59})(?:\.\d{1,24})?$/, message: t('Enter a positive decimal amount') };
  return <div className="page-stack">
    <PageHeader title={t('Approval settings')} description={t('Manage approval policies, reviewers, and audit history.')} />
    {!trustedSite ? <Alert type="error" title={t("Open approvals only on the configured console site.")} /> : activationToken ? <ApprovalActivationForm token={activationToken} onComplete={() => { activationCompleted.current = true; window.history.replaceState(null, '', window.location.pathname + window.location.search); clearIdentity(); setActivationToken(undefined); setLoginError(''); }} /> : checking ? <Card loading /> : !principal ? <Card title={t('Independent approval sign in')} style={{ maxWidth: 460 }}>
      <p>{t('Use your separately activated approval account.')}</p>{loginError && <Alert type="error" title={loginError} />}
      <Form layout="vertical" onFinish={login} preserve={false}><Form.Item name="email" label={t('Email')} rules={[{ required: true, type: 'email' }]}><Input autoComplete="username" /></Form.Item>
        <Form.Item name="password" label={t('Password')} rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>{t('Sign in')}</Button></Form>
    </Card> : <>
      <Space style={{ marginBottom: 16 }}><Typography.Text>{principal.displayName}</Typography.Text><Button onClick={() => void logout()}>{t('Sign out')}</Button></Space>
      <Tabs onChange={key => { if (key === 'policies') void loadPolicies(); }} items={[
        { key: 'requests', label: t('Approval queue'), children: <>
          <Space wrap style={{ marginBottom: 16 }}><Select aria-label={t('Approval status')} value={status} onChange={value => { setStatus(value); setPagination(p => ({ ...p, current: 1 })); }} options={['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', ''].map(value => ({ value, label: t(value || 'All') }))} />
            <Typography.Text type="secondary" role="status">{t('Updates automatically every 5 seconds')}{rows.updatedAt ? ` · ${rows.updatedAt.toLocaleTimeString()}` : ''}</Typography.Text></Space>
          {rows.error && <Alert type="warning" title={t('Unable to update approvals; retrying automatically.')} description={rows.error} />}
          <Table<Request> rowKey={r => r.intent.id} loading={rows.loading && !rows.data} dataSource={rows.data?.items ?? []} scroll={{ x: 1100 }}
            pagination={{ ...pagination, total: rows.data?.total ?? 0, onChange: (current, pageSize) => setPagination({ current, pageSize }) }} columns={[
              { title: t('Order'), render: (_, r) => r.intent.businessReference }, { title: t('Chain'), render: (_, r) => `${r.intent.chain} / ${r.intent.network}` },
              { title: t('Amount'), render: (_, r) => `${r.intent.amount} ${r.intent.assetSymbol}` }, { title: t('Recipient'), render: (_, r) => <Typography.Text copyable>{r.intent.recipient}</Typography.Text> },
              { title: t('Approval reasons'), render: (_, r) => r.reasons.map(reason => <Tag key={reason}>{t(reason)}</Tag>) }, { title: t('Required reviewers'), dataIndex: 'requiredReviewers' },
              { title: t('Status'), dataIndex: 'status', render: value => t(value) }, { title: t('Actions'), render: (_, r) => <Button onClick={() => void inspect(r)}>{t(r.status === 'PENDING' ? 'Review' : 'Details')}</Button> },
            ]} />
        </> },
        ...(principal.role === 'TENANT_ADMIN' ? [{ key: 'policies', label: t('Approval policies'), children: <>
          <Button onClick={() => openPolicy()}>{t('Add policy')}</Button><Table<Policy> rowKey={p => `${p.chain}/${p.network}/${p.assetSymbol}`} dataSource={policies} pagination={false} columns={[
            { title: t('Chain'), dataIndex: 'chain' }, { title: t('Network'), dataIndex: 'network' }, { title: t('Asset'), dataIndex: 'assetSymbol' }, { title: t('Single amount threshold'), dataIndex: 'singleAmount' },
            { title: t('Rolling 24h threshold'), dataIndex: 'rolling24hAmount' }, { title: t('All withdrawals require approval'), dataIndex: 'allWithdrawals', render: value => t(value ? 'Enabled' : 'Disabled') }, { title: t('Actions'), render: (_, p) => <Button onClick={() => openPolicy(p)}>{t('Edit')}</Button> },
          ]} />
        </> },
        { key: 'members', label: t('Independent reviewers'), children: <ApprovalMembersPanel key={`${principal.tenantId}/${principal.memberId}`} csrf={principal.csrfToken} onExpired={expired} /> },
        { key: 'audit', label: t('Approval audit'), children: <ApprovalAuditPanel key={`${principal.tenantId}/${principal.memberId}`} onExpired={expired} /> },
        ] : []),
      ]} />
      <Modal width={880} title={t('Review withdrawal')} open={Boolean(selected)} confirmLoading={busy} okButtonProps={{ disabled: !canReview }} okText={t('Record decision')} onOk={() => decisionForm.submit()} onCancel={() => setSelected(undefined)}>
        {selected && <Descriptions column={1} items={[
          { key: 'order', label: t('Order'), children: selected.intent.businessReference }, { key: 'chain', label: t('Chain'), children: `${selected.intent.chain} / ${selected.intent.network}` },
          { key: 'amount', label: t('Amount'), children: `${selected.intent.amount} ${selected.intent.assetSymbol}` }, { key: 'recipient', label: t('Recipient'), children: selected.intent.recipient },
          { key: 'assetIdentity', label: t('Asset identifier'), children: selected.assetSnapshot.tokenIdentifier ?? t('Native asset') },
          { key: 'networkIdentity', label: t('Network identity'), children: selected.assetSnapshot.networkIdentity },
          { key: 'fee', label: t('Maximum network fee'), children: `${selected.intent.maximumNetworkFee} ${selected.assetSnapshot.nativeSymbol}` }, { key: 'source', label: t('Source'), children: selected.intent.source },
          { key: 'externalReference', label: t('External reference'), children: selected.intent.externalReference },
          { key: 'fundingSource', label: t('Funding source'), children: selected.intent.fundingSource === 'TENANT_POOL' ? t('Tenant pool') : selected.intent.fundingSource === 'ADDRESS' ? t('Address') : '—' },
          { key: 'subject', label: t('Subject'), children: selected.intent.subject }, { key: 'expiry', label: t('Expires at'), children: selected.expiresAt },
        ]} />}
        <Typography.Title level={5}>{t('Decision history')}</Typography.Title>
        <Typography.Paragraph>{t('Approval progress')}: {history.filter(item => item.decision === 'APPROVE').length} / {selected?.requiredReviewers ?? 0}</Typography.Paragraph>
        {historyError && <Alert type="error" title={historyError} action={<Button onClick={() => selected && void inspect(selected)}>{t('Retry')}</Button>} />}
        <Table<DecisionHistory> size="small" rowKey="reviewerId" loading={historyLoading} dataSource={history} pagination={false} columns={[
          { title: t('Reviewer'), dataIndex: 'reviewerId' }, { title: t('Decision'), dataIndex: 'decision', render: value => t(value) }, { title: t('Reason'), dataIndex: 'reason' }, { title: t('Created at'), dataIndex: 'createdAt' },
        ]} />
        {!canReview && !historyLoading && <Alert type="info" title={t('This request is view-only: it is finalized, expired, already reviewed, or initiated by you.')} />}
        <Form disabled={!canReview} form={decisionForm} layout="vertical" onFinish={recordDecision}><Form.Item label={t('Decision')}><Select value={decision} onChange={setDecision} options={[{ value: 'APPROVE', label: t('Approve') }, { value: 'REJECT', label: t('Reject') }]} /></Form.Item>
          <Form.Item name="reason" label={t('Reason')} rules={[{ required: true, whitespace: true, max: 1000 }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="password" label={t('Approval password')} rules={[{ required: true }]}><Input.Password autoComplete="off" /></Form.Item></Form>
      </Modal>
      <Modal title={t('Approval policy')} open={policyOpen} confirmLoading={busy} onOk={() => policyForm.submit()} onCancel={() => setPolicyOpen(false)}>
        <p>{t('Policy changes apply to new withdrawal requests.')}</p>
        <Form form={policyForm} layout="vertical" onFinish={savePolicy} preserve={false}>
          <Form.Item name="chain" label={t('Chain')} rules={[{ required: true, pattern: /^[A-Z][A-Z0-9_]{0,31}$/ }]}><Input disabled={Boolean(editingPolicy)} /></Form.Item>
          <Form.Item name="network" label={t('Network')} rules={[{ required: true, pattern: /^[a-zA-Z0-9_.:-]{1,128}$/ }]}><Input disabled={Boolean(editingPolicy)} /></Form.Item>
          <Form.Item name="assetSymbol" label={t('Asset')} rules={[{ required: true, pattern: /^[A-Z][A-Z0-9_.-]{0,31}$/ }]}><Input disabled={Boolean(editingPolicy)} /></Form.Item>
          <Form.Item name="allWithdrawals" label={t('All withdrawals require approval')} rules={[{ required: true }]}><Select options={[{ value: true, label: t('Enabled') }, { value: false, label: t('Disabled') }]} /></Form.Item>
          <Form.Item name="singleAmount" label={t('Single amount threshold')} rules={[decimal]}><Input inputMode="decimal" /></Form.Item>
          <Form.Item name="rolling24hAmount" label={t('Rolling 24h threshold')} rules={[decimal]}><Input inputMode="decimal" /></Form.Item>
          <Form.Item name="newRecipient" label={t('New recipient requires approval')}><Select options={[{ value: true, label: t('Enabled') }, { value: false, label: t('Disabled') }]} /></Form.Item>
          <Form.Item name="consoleWithdrawal" label={t('Console withdrawal requires approval')}><Select options={[{ value: true, label: t('Enabled') }, { value: false, label: t('Disabled') }]} /></Form.Item>
          <Form.Item name="requiredReviewers" label={t('Required reviewers')}><Select options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} /></Form.Item>
          <Form.Item name="expirySeconds" label={t('Approval validity')}><Select options={[{ value: 900, label: t('15 minutes') }, { value: 3600, label: t('1 hour') }, { value: 86400, label: t('24 hours') }]} /></Form.Item>
        </Form>
      </Modal>
    </>}
  </div>;
}
