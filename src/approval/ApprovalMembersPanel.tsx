import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Checkbox, Form, Input, Modal, Space, Table, Typography } from 'antd';
import { approvalRequest, ApprovalApiError } from './client';
import { useApprovalPolling } from './useApprovalPolling';
import { useI18n } from '../i18n';

type Member = { id: string; email: string; displayName: string; role: string; status: string; createdAt: string; updatedAt: string; walletRevocationSequence: number };
type Page = { items: Member[]; total: number };
type Activation = { memberId: string; token: string; expiresAt: string };
type Fields = { memberId: string; email: string; displayName: string; reason: string; acknowledgeRevocation?: boolean };

export function ApprovalMembersPanel({ csrf, onExpired }: { csrf: string; onExpired: () => void }) {
  const { t } = useI18n(); const { message } = App.useApp();
  const [page, setPage] = useState({ current: 1, pageSize: 20 }); const [revision, setRevision] = useState(0);
  const [operation, setOperation] = useState<{ kind: 'invite' | 'reset' | 'disable'; member?: Member }>();
  const [activation, setActivation] = useState<Activation>(); const [busy, setBusy] = useState(false);
  const [revocation, setRevocation] = useState<{ memberId: string; sequence: number }>();
  const [form] = Form.useForm<Fields>(); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback((signal: AbortSignal) => approvalRequest<Page>(`/members?limit=${page.pageSize}&offset=${(page.current - 1) * page.pageSize}`, { signal }), [page]);
  const members = useApprovalPolling(load, onExpired, true, revision);
  const open = (kind: 'invite' | 'reset' | 'disable', member?: Member) => { form.resetFields(); setRevocation(undefined); setOperation({ kind, member }); };
  const save = async (fields: Fields) => {
    if (!operation) return; setBusy(true);
    const path = operation.kind === 'invite' ? '/members' : `/members/${operation.member?.id}/${operation.kind === 'reset' ? 'activation' : 'disable'}`;
    try {
      let sequence = operation.member?.walletRevocationSequence ?? 0;
      if (operation.kind === 'invite') {
        const current = await approvalRequest<{ sequence: number }>(`/members/${fields.memberId}/wallet-revocation`);
        if (!alive.current) return;
        if (!Number.isSafeInteger(current.sequence) || current.sequence < 0) throw new Error(t('Unable to verify reviewer revocation'));
        sequence = current.sequence;
        if (sequence > 0 && (!fields.acknowledgeRevocation || revocation?.memberId !== fields.memberId || revocation.sequence !== sequence)) {
          setRevocation({ memberId: fields.memberId, sequence }); form.setFieldValue('acknowledgeRevocation', false); return;
        }
      }
      const body = operation.kind === 'invite'
        ? { memberId: fields.memberId, email: fields.email, displayName: fields.displayName, reason: fields.reason, acknowledgedWalletRevocation: sequence }
        : operation.kind === 'reset' ? { reason: fields.reason, acknowledgedWalletRevocation: sequence } : { reason: fields.reason };
      const result = await approvalRequest<Activation>(path, { method: 'POST', csrf, body });
      if (!alive.current) return;
      setOperation(undefined); form.resetFields(); setRevision(n => n + 1);
      if (operation.kind !== 'disable') setActivation(result); else void message.success(t('Reviewer disabled and sessions revoked'));
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof ApprovalApiError && error.status === 401) onExpired(); else void message.error(error instanceof Error ? error.message : t('Unable to update reviewer'));
    } finally { if (alive.current) setBusy(false); }
  };
  const activationLink = activation ? `${window.location.origin}/approval#activate=${activation.token}` : '';
  return <>
    <p>{t('Invite the verified Wallet subaccount using its public member ID. Approval credentials remain separate.')}</p>
    <Button onClick={() => open('invite')}>{t('Invite reviewer')}</Button>
    {members.error && <Alert type="warning" title={t('Unable to load reviewers; retrying automatically.')} description={members.error} />}
    <Table<Member> rowKey="id" dataSource={members.data?.items ?? []} loading={members.loading && !members.data} scroll={{ x: 1000 }}
      pagination={{ ...page, total: members.data?.total ?? 0, onChange: (current, pageSize) => setPage({ current, pageSize }) }} columns={[
        { title: t('Wallet member ID'), dataIndex: 'id', render: value => <Typography.Text copyable>{value}</Typography.Text> },
        { title: t('Name'), dataIndex: 'displayName' }, { title: t('Email'), dataIndex: 'email' },
        { title: t('Role'), dataIndex: 'role', render: value => t(value) }, { title: t('Status'), dataIndex: 'status', render: value => t(value) },
        { title: t('Wallet revocation record'), dataIndex: 'walletRevocationSequence', render: value => value > 0 ? `#${value}` : '—' },
        { title: t('Actions'), render: (_, member) => member.role === 'APPROVER' ? <Space>
          <Button onClick={() => open('reset', member)}>{t('Reset independent credentials')}</Button>
          <Button danger disabled={member.status === 'DISABLED'} onClick={() => open('disable', member)}>{t('Disable reviewer')}</Button>
        </Space> : t('Managed on the trusted host') },
      ]} />
    {operation && <Modal title={t(operation.kind === 'invite' ? 'Invite reviewer' : operation.kind === 'reset' ? 'Reset independent credentials' : 'Disable reviewer')}
      open confirmLoading={busy} onOk={() => form.submit()} onCancel={() => { if (!busy) setOperation(undefined); }}>
      {operation?.kind !== 'invite' && <><p>{operation?.member?.displayName} · {operation?.member?.email}</p>
        <Alert type="warning" title={t(operation?.kind === 'reset' ? 'The old password, sessions and activation link stop working immediately.' : 'This stops new reviews and revokes approval sessions immediately.')} /></>}
      <Form form={form} layout="vertical" onFinish={save} preserve={false} disabled={busy}>
        {operation?.kind === 'invite' && <>
          <Form.Item name="memberId" label={t('Wallet member ID')} rules={[{ required: true, pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i }]}><Input onChange={() => { setRevocation(undefined); form.setFieldValue('acknowledgeRevocation', false); }} /></Form.Item>
          <Form.Item name="email" label={t('Email')} rules={[{ required: true, type: 'email', max: 254 }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="displayName" label={t('Name')} rules={[{ required: true, whitespace: true, max: 120 }]}><Input /></Form.Item>
        </>}
        {operation.kind !== 'disable' && ((operation.member?.walletRevocationSequence ?? 0) > 0 || (revocation?.sequence ?? 0) > 0) && <>
          <Alert type="warning" title={t('Wallet previously revoked this reviewer. Verify their current subaccount and identity before restoring approval access.')} />
          <Form.Item name="acknowledgeRevocation" valuePropName="checked" rules={[{ validator: (_, value) => value === true ? Promise.resolve() : Promise.reject(new Error(t('Confirm the reviewer may be re-enrolled'))) }]}>
            <Checkbox>{t('I verified this reviewer and explicitly approve re-enrollment')}</Checkbox>
          </Form.Item>
        </>}
        <Form.Item name="reason" label={t('Reason')} rules={[{ required: true, whitespace: true, min: 5, max: 512 }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>}
    {activation && <Modal title={t('Single-use activation link')} open footer={<Button onClick={() => setActivation(undefined)}>{t('Close')}</Button>} onCancel={() => setActivation(undefined)}>
      <p>{t('Share this link privately with the verified reviewer. It expires in 24 hours and is shown only once.')}</p>
      <Typography.Paragraph copyable={{ text: activationLink }} style={{ wordBreak: 'break-all' }}>{activationLink}</Typography.Paragraph>
      <p>{t('Expires at')}: {activation?.expiresAt}</p>
    </Modal>}
  </>;
}

type Audit = { id: string; actorType: string; actorId: string; action: string; entityId: string; detail: unknown; createdAt: string };
export function ApprovalAuditPanel({ onExpired }: { onExpired: () => void }) {
  const { t } = useI18n(); const [action, setAction] = useState(''); const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const load = useCallback((signal: AbortSignal) => approvalRequest<{ items: Audit[]; total: number }>(`/audits?action=${encodeURIComponent(action)}&limit=${page.pageSize}&offset=${(page.current - 1) * page.pageSize}`, { signal }), [action, page]);
  const audits = useApprovalPolling(load, onExpired, true, 0);
  return <>
    <Input.Search aria-label={t('Audit action filter')} placeholder={t('Audit action filter')} allowClear style={{ maxWidth: 420, marginBottom: 16 }}
      onSearch={value => { setAction(value.trim()); setPage(p => ({ ...p, current: 1 })); }} />
    {audits.error && <Alert type="warning" title={t('Unable to load audit records; retrying automatically.')} description={audits.error} />}
    <Table<Audit> rowKey="id" dataSource={audits.data?.items ?? []} loading={audits.loading && !audits.data} scroll={{ x: 1000 }}
      pagination={{ ...page, total: audits.data?.total ?? 0, onChange: (current, pageSize) => setPage({ current, pageSize }) }}
      expandable={{ expandedRowRender: row => <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(row.detail, null, 2)}</pre> }} columns={[
        { title: t('Time'), dataIndex: 'createdAt' }, { title: t('Action'), dataIndex: 'action' }, { title: t('Actor'), render: (_, row) => `${row.actorType} / ${row.actorId}` },
        { title: t('Resource'), dataIndex: 'entityId' },
      ]} />
  </>;
}
