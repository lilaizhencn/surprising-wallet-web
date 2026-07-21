import { useState } from 'react';
import { App, Empty, Space, Switch, Table, Tag, Typography } from 'antd';
import { api } from '../api/client';
import { hasRole, useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';

type TenantChain = {
  chain: string;
  network: string;
  family: string;
  nativeSymbol: string;
  assetSymbols: string[];
  status: string;
  enabled: boolean;
  scanEnabled: boolean;
  withdrawalEnabled: boolean;
  transferEnabled: boolean;
  capabilities: string[];
  openedAt?: string;
  closedAt?: string;
};

export default function TenantChainsPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [saving, setSaving] = useState<string>();
  const canManage = hasRole(session, 'TENANT_ADMIN');
  const query = useApiQuery<TenantChain[]>((signal) => session
    ? api.get('/custody/console/v1/chains', signal)
    : Promise.resolve([]), [session?.userId]);

  const toggle = async (row: TenantChain, enabled: boolean) => {
    setSaving(row.chain);
    try {
      await api.put(`/custody/console/v1/chains/${row.chain}`, { enabled });
      await message.success(t(enabled ? 'Chain opened' : 'Chain closed'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update chain'));
    } finally {
      setSaving(undefined);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Tenant chains')}
        description={t('Open only the chains this tenant will use. Closing a chain blocks new API operations while preserving balances and history.')}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <Table<TenantChain>
          rowKey="chain"
          loading={query.loading}
          dataSource={query.data ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description={t('No executable platform chains are available')} /> }}
          scroll={{ x: 980 }}
          columns={[
            {
              title: t('Chain'),
              render: (_, row) => (
                <Space>
                  <ChainLogo chain={row.chain} size={28} />
                  <span><Typography.Text strong>{row.chain}</Typography.Text><br /><small>{row.network}</small></span>
                </Space>
              ),
            },
            {
              title: t('Assets'),
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  {row.assetSymbols.map((symbol) => (
                    <Tag key={symbol} icon={<AssetLogo symbol={symbol} size={14} />}>{symbol}</Tag>
                  ))}
                </Space>
              ),
            },
            { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: t('Platform operations'),
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={row.scanEnabled ? 'green' : 'default'}>{t('Deposits')}</Tag>
                  <Tag color={row.withdrawalEnabled ? 'green' : 'default'}>{t('Withdrawals')}</Tag>
                </Space>
              ),
            },
            {
              title: t('Open for tenant'),
              align: 'right',
              render: (_, row) => (
                <Switch
                  checked={row.enabled}
                  disabled={!canManage || saving !== undefined}
                  loading={saving === row.chain}
                  onChange={(enabled) => void toggle(row, enabled)}
                  aria-label={`${row.chain} ${t('Open for tenant')}`}
                />
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
