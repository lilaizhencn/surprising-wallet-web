import { useEffect, useState } from 'react';
import { Alert, App, Button, Empty, Progress, Space, Table, Tag, Typography } from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { hasRole, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatAmount, formatDate } from '../utils/format';
import { useI18n } from '../i18n';

type AssetRow = {
  chain: string;
  assetSymbol: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  addressCount: number;
  usdPrice?: string | number;
  valueUsd?: string | number;
  priceSource?: string;
  priceObservedAt?: string;
};

type SymbolAggregate = {
  assetSymbol: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  valueUsd?: string | number;
  chains: string[];
};

type AssetDashboard = {
  asOf: string;
  displayCurrency: string;
  totalValueUsd: string | number;
  unpricedAssetCount: number;
  oldestPriceObservedAt?: string;
  assets: AssetRow[];
  bySymbol: SymbolAggregate[];
  openedChains: OpenedChain[];
};

type OpenedChain = {
  chain: string;
  network: string;
  family: string;
  nativeSymbol: string;
  assetSymbols: string[];
  collectionAddressId?: string;
  collectionAddress?: string;
  memo?: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  lowBalance: boolean;
  status: string;
};

type WebhookRow = {
  id: string;
  name: string;
  url: string;
  status: string;
  successRate24h?: number;
  lastDeliveryAt?: string;
};

type TransferRow = {
  id: string;
  chain: string;
  assetSymbol: string;
  amount: string | number;
  status: string;
  createdAt: string;
};

type OverviewData = {
  dashboard: AssetDashboard;
  webhooks: WebhookRow[];
  recent: Array<TransferRow & { kind: 'Deposit' | 'Withdrawal' }>;
  onboarding?: OnboardingStatus;
};

type OnboardingStatus = {
  chainOpened: boolean;
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
  ipAllowlistConfigured: boolean;
  addressCreated: boolean;
  gasAccountConfigured: boolean;
  gasAccountFunded: boolean;
  completedSteps: number;
  totalSteps: number;
  ready: boolean;
};

const emptyDashboard: AssetDashboard = {
  asOf: '',
  displayCurrency: 'USD',
  totalValueUsd: 0,
  unpricedAssetCount: 0,
  assets: [],
  bySymbol: [],
  openedChains: [],
};

const onboardingSteps = [
  {
    key: 'chainOpened' as const,
    title: 'Open a chain',
    description: 'Enable each network before using its APIs.',
    to: '/console/chains',
  },
  {
    key: 'apiKeyConfigured' as const,
    title: 'Create an API key',
    description: 'Store the full-access secret securely on your server.',
    to: '/console/api-access',
  },
  {
    key: 'ipAllowlistConfigured' as const,
    title: 'Enforce trusted IPs',
    description: 'Add a CIDR rule before turning enforcement on.',
    to: '/console/api-access',
  },
  {
    key: 'webhookConfigured' as const,
    title: 'Verify a Webhook',
    description: 'Complete the signed challenge-response check.',
    to: '/console/api-access',
  },
  {
    key: 'gasAccountConfigured' as const,
    title: 'Create a collection address',
    description: 'Generate a dedicated collection address for every enabled chain.',
    to: '/console/assets',
  },
  {
    key: 'gasAccountFunded' as const,
    title: 'Fund a chain address',
    description: 'Confirmed native coins are automatically available for network fees.',
    to: '/console/assets',
  },
  {
    key: 'addressCreated' as const,
    title: 'Create a customer address',
    description: 'Test the same address-allocation flow your API will use.',
    to: '/console/addresses',
  },
];

export default function OverviewPage({ assetsOnly = false }: { assetsOnly?: boolean }) {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [generatingChain, setGeneratingChain] = useState<string>();
  const query = useApiQuery<OverviewData>(
    async (signal) => {
      if (!session) return { dashboard: emptyDashboard, webhooks: [], recent: [] };
      if (assetsOnly) {
        const dashboard = await api.get<AssetDashboard>('/custody/console/v1/dashboard', signal);
        return { dashboard, webhooks: [], recent: [] };
      }
      const [dashboard, webhooks, deposits, withdrawals, onboarding] = await Promise.all([
        api.get<AssetDashboard>('/custody/console/v1/dashboard', signal),
        api.get<WebhookRow[]>('/custody/console/v1/webhooks', signal),
        api.get<TransferRow[]>('/custody/console/v1/deposits?limit=5', signal),
        api.get<TransferRow[]>('/custody/console/v1/withdrawals?limit=5', signal),
        api.get<OnboardingStatus>('/custody/console/v1/onboarding', signal),
      ]);
      const recent = [
        ...deposits.map((row) => ({ ...row, kind: 'Deposit' as const })),
        ...withdrawals.map((row) => ({ ...row, kind: 'Withdrawal' as const })),
      ]
        .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8);
      return { dashboard, webhooks, recent, onboarding };
    },
    [session?.userId, assetsOnly],
  );

  useEffect(() => {
    const timer = window.setInterval(query.refetch, 15_000);
    return () => window.clearInterval(timer);
  }, [query.refetch]);

  const assets = query.data?.dashboard.assets ?? [];
  const totalAddresses = assets.reduce((sum, row) => sum + row.addressCount, 0);
  const activeAssets = assets.filter((row) => Number(row.totalBalance) !== 0).length;
  const degradedWebhooks = (query.data?.webhooks ?? []).filter(
    (row) => row.status !== 'ACTIVE' || (row.successRate24h ?? 100) < 95,
  );
  const canGenerateCollectionAddress = hasRole(session, 'TENANT_ADMIN');

  const generateCollectionAddress = async (chain: string) => {
    setGeneratingChain(chain);
    try {
      await api.post('/custody/console/v1/gas-accounts', { chain });
      query.refetch();
      void message.success(t('{chain} collection address generated', { chain }));
    } catch (error) {
      void message.error(error instanceof Error
        ? error.message
        : t('Unable to generate collection address'));
    } finally {
      setGeneratingChain(undefined);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t(assetsOnly ? 'Assets' : 'Asset overview')}
        description={t('Consolidated balances and activity across every configured chain.')}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />

      {query.data?.dashboard.unpricedAssetCount ? (
        <Alert
          showIcon
          type="info"
          title={t('{count} funded assets do not have a USD price snapshot', {
            count: query.data.dashboard.unpricedAssetCount,
          })}
          description={t('The portfolio total includes only priced assets; token quantities remain complete.')}
        />
      ) : null}

      {!assetsOnly && query.data?.onboarding ? (
        <section className="data-panel onboarding-panel">
          <div className="onboarding-heading">
            <div>
              <span className="eyebrow">{t('Tenant activation')}</span>
              <h2>{t(query.data.onboarding.ready ? 'Ready for integration' : 'Finish your setup')}</h2>
              <p>
                {t('Complete each operational control before sending production traffic.')}
              </p>
            </div>
            <div className="onboarding-progress">
              <Progress
                type="circle"
                size={76}
                percent={Math.round(
                  query.data.onboarding.completedSteps
                    / query.data.onboarding.totalSteps * 100,
                )}
              />
            </div>
          </div>
          <div className="onboarding-steps">
            {onboardingSteps.map((step) => {
              const complete = query.data?.onboarding?.[step.key] === true;
              return (
                <Link
                  key={step.key}
                  to={step.to}
                  className={`onboarding-step${complete ? ' complete' : ''}`}
                >
                  {complete
                    ? <CheckCircleFilled aria-hidden />
                    : <ClockCircleOutlined aria-hidden />}
                  <span>
                    <strong>{t(step.title)}</strong>
                    <small>{t(step.description)}</small>
                  </span>
                  <ArrowRightOutlined aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {!assetsOnly ? (
        <section className="overview-band" aria-label={t('Tenant asset summary')}>
          <div>
            <span>{t('Total asset value')}</span>
            <strong>${formatAmount(query.data?.dashboard.totalValueUsd ?? 0)}</strong>
            <small>{t('Live ledger, USD snapshot')}</small>
          </div>
          <div>
            <span>{t('Assets with balance')}</span>
            <strong>{activeAssets}</strong>
            <small>{t('Across enabled networks')}</small>
          </div>
          <div>
            <span>{t('Funded address links')}</span>
            <strong>{totalAddresses}</strong>
            <small>{t('Distinct custody mappings')}</small>
          </div>
        </section>
      ) : null}

      <section className="data-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('Enabled chain addresses')}</h2>
            <p>{t('Every enabled chain is listed even before it has a balance.')}</p>
          </div>
        </div>
        <Alert
          showIcon
          type="info"
          title={t('Generated addresses can receive deposits and pay network fees')}
          description={t('Send assets only on the matching chain. Confirmed native-coin deposits to generated addresses are automatically available as gas for on-chain operations.')}
        />
        <Table<OpenedChain>
          rowKey="chain"
          loading={query.loading}
          dataSource={query.data?.dashboard.openedChains ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description={t('No chain has been enabled for this tenant')} /> }}
          scroll={{ x: 1180 }}
          columns={[
            {
              title: t('Network'),
              width: 140,
              render: (_, row) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{row.chain}</Typography.Text>
                  <Typography.Text type="secondary">{row.network}</Typography.Text>
                </Space>
              ),
            },
            {
              title: t('Supported assets'),
              dataIndex: 'assetSymbols',
              width: 210,
              render: (symbols: string[]) => (
                <Space size={[4, 4]} wrap>
                  {symbols.map((symbol) => <Tag key={symbol}>{symbol}</Tag>)}
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
              title: t('Native balance'),
              align: 'right',
              width: 160,
              render: (_, row) => `${formatAmount(row.totalBalance)} ${row.nativeSymbol}`,
            },
            {
              title: t('Status'),
              width: 140,
              render: (_, row) => (
                <StatusText value={row.collectionAddress ? row.status : 'NOT_GENERATED'} />
              ),
            },
            {
              title: t('Action'),
              fixed: 'right',
              width: 140,
              render: (_, row) => row.collectionAddress ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <Button
                  type="primary"
                  disabled={!canGenerateCollectionAddress}
                  loading={generatingChain === row.chain}
                  onClick={() => void generateCollectionAddress(row.chain)}
                >
                  {t('Generate address')}
                </Button>
              ),
            },
          ]}
        />
      </section>

      <section className="data-panel">
        <div className="panel-heading"><h2>{t('Assets')}</h2></div>
        <Table<AssetRow>
          rowKey={(row) => `${row.chain}:${row.assetSymbol}`}
          loading={query.loading}
          dataSource={assets}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={t('No funded tenant assets yet')} /> }}
          scroll={{ x: 860 }}
          columns={[
            {
              title: t('Asset'),
              dataIndex: 'assetSymbol',
              render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
            },
            { title: t('Network'), dataIndex: 'chain' },
            {
              title: t('Total balance'),
              dataIndex: 'totalBalance',
              align: 'right',
              sorter: (a, b) => Number(a.totalBalance) - Number(b.totalBalance),
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            {
              title: t('USD value'),
              dataIndex: 'valueUsd',
              align: 'right',
              render: (value) => value === null || value === undefined
                ? '—' : `$${formatAmount(value)}`,
            },
            {
              title: t('Available'),
              dataIndex: 'availableBalance',
              align: 'right',
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            {
              title: t('Locked'),
              dataIndex: 'lockedBalance',
              align: 'right',
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            { title: t('Addresses'), dataIndex: 'addressCount', align: 'right' },
            {
              title: t('Status'),
              render: () => <StatusText value="ACTIVE" />,
            },
          ]}
        />
      </section>

      <section className="data-panel">
        <div className="panel-heading">
          <h2>{t('Cross-chain asset totals')}</h2>
          <small>{t('USDT, USDC, and every same-symbol asset are aggregated across networks.')}</small>
        </div>
        <Table<SymbolAggregate>
          rowKey="assetSymbol"
          loading={query.loading}
          dataSource={query.data?.dashboard.bySymbol ?? []}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={t('No cross-chain assets yet')} /> }}
          columns={[
            {
              title: t('Asset'),
              dataIndex: 'assetSymbol',
              render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
            },
            {
              title: t('Networks'),
              dataIndex: 'chains',
              render: (chains: string[]) => chains.join(', '),
            },
            {
              title: t('Total balance'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.totalBalance)} ${row.assetSymbol}`,
            },
            {
              title: t('USD value'),
              dataIndex: 'valueUsd',
              align: 'right',
              render: (value) => value === null || value === undefined
                ? '—' : `$${formatAmount(value)}`,
            },
          ]}
        />
      </section>

      {!assetsOnly ? (
        <div className="overview-grid">
          <section className="data-panel">
            <div className="panel-heading">
              <h2>{t('Recent custody activity')}</h2>
              <Link to="/console/deposits">{t('View records')} <ArrowRightOutlined /></Link>
            </div>
            <Table
              rowKey="id"
              size="small"
              loading={query.loading}
              dataSource={query.data?.recent ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description={t('No custody activity yet')} /> }}
              columns={[
                { title: t('Type'), dataIndex: 'kind', render: (value: string) => t(value) },
                { title: t('Network'), dataIndex: 'chain' },
                {
                  title: t('Amount'),
                  render: (_, row) => `${formatAmount(row.amount)} ${row.assetSymbol}`,
                },
                { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                { title: t('Time'), dataIndex: 'createdAt', render: formatDate },
              ]}
            />
          </section>
          <section className="data-panel">
            <div className="panel-heading">
              <h2>{t('Webhook health')}</h2>
              <Link to="/console/api-access"><LinkOutlined /> {t('Manage developer access')}</Link>
            </div>
            {degradedWebhooks.length ? (
              <Alert
                showIcon
                type="warning"
                title={t('{count} webhook endpoints need attention', { count: degradedWebhooks.length })}
              />
            ) : null}
            <Table<WebhookRow>
              rowKey="id"
              size="small"
              loading={query.loading}
              dataSource={query.data?.webhooks ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description={t('No webhook endpoint configured')} /> }}
              columns={[
                { title: t('Endpoint'), dataIndex: 'name' },
                { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                {
                  title: t('Success (24h)'),
                  dataIndex: 'successRate24h',
                  render: (value?: number) => value === null || value === undefined ? '—' : `${value.toFixed(1)}%`,
                },
                { title: t('Last delivery'), dataIndex: 'lastDeliveryAt', render: formatDate },
              ]}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
