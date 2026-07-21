import { useState } from 'react';
import { App, Button, Empty, Space, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { hasRole, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';

type TenantToken = {
  symbol: string;
  standard: string;
  contractAddress: string;
  decimals: number;
  enabled: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
};

type TenantChain = {
  chain: string;
  network: string;
  family: string;
  nativeSymbol: string;
  tokens: TenantToken[];
  status: string;
  enabled: boolean;
  scanEnabled: boolean;
  withdrawalEnabled: boolean;
  transferEnabled: boolean;
  capabilities: string[];
  collectionAddressId?: string;
  collectionAddress?: string;
  memo?: string;
  openedAt?: string;
  closedAt?: string;
};

type TokenSettings = Pick<TenantToken, 'enabled' | 'depositEnabled' | 'withdrawalEnabled'>;

export default function TenantChainsPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [saving, setSaving] = useState<string>();
  const canManage = hasRole(session, 'TENANT_ADMIN');
  const query = useApiQuery<TenantChain[]>((signal) => session
    ? api.get('/custody/console/v1/chains', signal)
    : Promise.resolve([]), [session?.userId]);

  const toggleChain = async (row: TenantChain, enabled: boolean) => {
    const key = `chain:${row.chain}`;
    setSaving(key);
    try {
      await api.put(`/custody/console/v1/chains/${row.chain}`, { enabled });
      query.refetch();
      void message.success(t(enabled ? 'Chain opened' : 'Chain closed'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update chain'));
    } finally {
      setSaving(undefined);
    }
  };

  const generateAddress = async (chain: string) => {
    const key = `address:${chain}`;
    setSaving(key);
    try {
      await api.post('/custody/console/v1/gas-accounts', { chain });
      query.refetch();
      void message.success(t('{chain} collection address generated', { chain }));
    } catch (error) {
      void message.error(error instanceof Error
        ? error.message
        : t('Unable to generate collection address'));
    } finally {
      setSaving(undefined);
    }
  };

  const saveToken = async (chain: TenantChain, token: TenantToken, values: TokenSettings) => {
    const key = `token:${chain.chain}:${token.symbol}`;
    setSaving(key);
    try {
      await api.put(
        `/custody/console/v1/chains/${chain.chain}/tokens/${token.symbol}`,
        values,
      );
      query.refetch();
      void message.success(t('{symbol} settings updated', { symbol: token.symbol }));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update token'));
    } finally {
      setSaving(undefined);
    }
  };

  const tokenArea = (chain: TenantChain) => (
    <div className="tenant-token-area">
      <div className="tenant-token-heading">
        <div>
          <Typography.Text strong>{t('Available tokens')}</Typography.Text>
          <Typography.Text type="secondary">
            {t('Enable only the tokens this tenant accepts on {chain}.', { chain: chain.chain })}
          </Typography.Text>
        </div>
        {!chain.scanEnabled || !chain.withdrawalEnabled ? (
          <Tag color="warning">{t('Limited by platform operations')}</Tag>
        ) : null}
      </div>
      <Table<TenantToken>
        rowKey="symbol"
        size="small"
        pagination={false}
        dataSource={chain.tokens}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('Native asset only')} /> }}
        columns={[
          {
            title: t('Token'),
            render: (_, token) => (
              <Space>
                <AssetLogo symbol={token.symbol} size={24} />
                <span>
                  <Typography.Text strong>{token.symbol}</Typography.Text><br />
                  <Typography.Text type="secondary">{token.standard}</Typography.Text>
                </span>
              </Space>
            ),
          },
          {
            title: t('Enabled'),
            width: 130,
            render: (_, token) => (
              <Switch
                checked={token.enabled}
                disabled={!canManage || !chain.enabled || saving !== undefined}
                loading={saving === `token:${chain.chain}:${token.symbol}`}
                onChange={(enabled) => void saveToken(chain, token, {
                  enabled,
                  depositEnabled: enabled ? token.depositEnabled : false,
                  withdrawalEnabled: enabled ? token.withdrawalEnabled : false,
                })}
                aria-label={`${chain.chain} ${token.symbol} ${t('Enabled')}`}
              />
            ),
          },
          {
            title: t('Deposits'),
            width: 130,
            render: (_, token) => (
              <Switch
                checked={token.depositEnabled}
                disabled={!canManage || !chain.enabled || !chain.scanEnabled
                  || !token.enabled || saving !== undefined}
                onChange={(depositEnabled) => void saveToken(chain, token, {
                  enabled: token.enabled,
                  depositEnabled,
                  withdrawalEnabled: token.withdrawalEnabled,
                })}
                aria-label={`${chain.chain} ${token.symbol} ${t('Deposits')}`}
              />
            ),
          },
          {
            title: t('Withdrawals'),
            width: 130,
            render: (_, token) => (
              <Switch
                checked={token.withdrawalEnabled}
                disabled={!canManage || !chain.enabled || !chain.withdrawalEnabled
                  || !chain.transferEnabled || !token.enabled || saving !== undefined}
                onChange={(withdrawalEnabled) => void saveToken(chain, token, {
                  enabled: token.enabled,
                  depositEnabled: token.depositEnabled,
                  withdrawalEnabled,
                })}
                aria-label={`${chain.chain} ${token.symbol} ${t('Withdrawals')}`}
              />
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <div className="page-stack tenant-chains-page">
      <PageHeader
        title={t('Tenant chains')}
        description={t('Open a chain, generate its collection address, and enable tenant tokens in one place.')}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel tenant-chains-panel">
        <Table<TenantChain>
          rowKey="chain"
          loading={query.loading}
          dataSource={query.data ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description={t('No executable platform chains are available')} /> }}
          scroll={{ x: 1460 }}
          expandable={{
            expandedRowRender: tokenArea,
            expandedRowKeys: (query.data ?? []).map((row) => row.chain),
            showExpandColumn: false,
          }}
          columns={[
            {
              title: t('Chain'),
              width: 210,
              render: (_, row) => (
                <Space>
                  <ChainLogo chain={row.chain} size={32} />
                  <span><Typography.Text strong>{row.chain}</Typography.Text><br /><small>{row.network}</small></span>
                </Space>
              ),
            },
            { title: t('Native asset'), width: 150, render: (_, row) => (
              <Space><AssetLogo symbol={row.nativeSymbol} size={22} />{row.nativeSymbol}</Space>
            ) },
            { title: t('Status'), width: 130, dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: t('Platform operations'),
              width: 210,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={row.scanEnabled ? 'green' : 'default'}>{t('Deposits')}</Tag>
                  <Tag color={row.withdrawalEnabled ? 'green' : 'default'}>{t('Withdrawals')}</Tag>
                </Space>
              ),
            },
            {
              title: t('Collection / gas address'),
              dataIndex: 'collectionAddress',
              className: 'collection-address-cell',
              width: 480,
              render: (address?: string) => address
                ? <CopyText value={address} compact={false} />
                : <Typography.Text type="secondary">{t('Not generated')}</Typography.Text>,
            },
            {
              title: t('Action'),
              fixed: 'right',
              width: 280,
              render: (_, row) => (
                <Space size={12}>
                  <Switch
                    checked={row.enabled}
                    disabled={!canManage || saving !== undefined}
                    loading={saving === `chain:${row.chain}`}
                    onChange={(enabled) => void toggleChain(row, enabled)}
                    aria-label={`${row.chain} ${t('Action')}`}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    aria-label={`${row.collectionAddress ? t('Address generated') : t('Generate address')} ${row.chain}`}
                    disabled={!canManage || !row.enabled || Boolean(row.collectionAddress)
                      || saving !== undefined}
                    loading={saving === `address:${row.chain}`}
                    onClick={() => void generateAddress(row.chain)}
                  >
                    {row.collectionAddress ? t('Address generated') : t('Generate address')}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
