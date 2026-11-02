import { useState } from 'react';
import { Alert, Button, Select, Space, Table, Typography } from 'antd';
import { approvalOrigin } from '../approval/origin';
import { apiRequest } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import type { PageResponse } from '../types/pagination';

type Withdrawal = { withdrawalId: string; state: string; intent: { id: string; businessReference: string; chain: string; network: string; amount: string; assetSymbol: string; recipient: string }; receipt?: { reasons: string[]; requiredReviewers: number; expiresAt: string; signingStarted: boolean } };
export default function ApprovalEntryPage() {
  const { t } = useI18n(); const origin = approvalOrigin();
  const [status, setStatus] = useState(''); const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const query = useApiQuery(signal => apiRequest<PageResponse<Withdrawal>>(`/custody/console/v1/approvals?status=${status}&limit=${page.pageSize}&offset=${(page.current - 1) * page.pageSize}`, { signal }), [status, page.current, page.pageSize]);
  return <><PageHeader title={t('Withdrawal approvals')} description={t('View all tenant withdrawal requests and their current approval status.')} actions={<Button onClick={query.refetch}>{t('Refresh')}</Button>} />
    <Alert type="info" title={t('Tenant administrators can assist with review using their independently activated administrator account.')} description={t('Review decisions and their audit history are available on the independent approval site. Self-approval and duplicate votes remain prohibited.')} style={{ marginBottom: 16 }} />
    <Space wrap style={{ marginBottom: 16 }}>
      <Select aria-label={t('Status')} value={status} style={{ minWidth: 180 }} onChange={v => { setStatus(v); setPage(p => ({ ...p, current: 1 })); }} options={['', 'QUEUED', 'PENDING', 'APPROVED', 'AUTHORIZED', 'REJECTED', 'EXPIRED'].map(value => ({ value, label: t(value || 'All') }))} />
      {origin && origin !== window.location.origin ? <Button type="primary" href={`${origin}/approval`} target="_blank" rel="noopener noreferrer">{t('Open independent approvals')}</Button>
        : <Alert type="warning" title={t('Independent approval site has not been configured.')} />}
    </Space>
    {query.error && <Alert type="error" title={query.error} action={<Button onClick={query.refetch}>{t('Retry')}</Button>} />}
    <Table<Withdrawal> rowKey="withdrawalId" loading={query.loading} dataSource={query.data?.items ?? []} scroll={{ x: 1000 }} pagination={{ ...page, total: query.data?.total ?? 0, onChange: (current, pageSize) => setPage({ current, pageSize }) }} expandable={{ expandedRowRender: r => <Space orientation="vertical"><Typography.Text copyable>{r.intent.id}</Typography.Text><Typography.Text>{t('Required reviewers')}: {r.receipt?.requiredReviewers ?? '—'}</Typography.Text><Typography.Text>{t('Approval reasons')}: {r.receipt?.reasons.map(reason => t(reason)).join(', ') || '—'}</Typography.Text><Typography.Text>{t('Expires at')}: {r.receipt?.expiresAt ?? '—'}</Typography.Text></Space> }} columns={[
      { title: t('Order'), render: (_, r) => r.intent.businessReference }, { title: t('Chain'), render: (_, r) => `${r.intent.chain} / ${r.intent.network}` },
      { title: t('Amount'), render: (_, r) => `${r.intent.amount} ${r.intent.assetSymbol}` }, { title: t('Recipient'), dataIndex: ['intent', 'recipient'], render: value => <Typography.Text copyable>{value}</Typography.Text> },
      { title: t('Status'), dataIndex: 'state', render: value => t(value) },
    ]} />
  </>;
}
