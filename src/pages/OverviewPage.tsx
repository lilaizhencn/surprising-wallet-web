import { useEffect } from 'react';
import { Alert, Empty, Progress, Space, Table, Tag, Typography } from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatAmount, formatDate } from '../utils/format';
import { useI18n } from '../i18n';

type AssetRow = {
  chain: string;
  assetSymbol: string;
  nativeAsset: boolean;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  addressCount: number;
  usdPrice?: string | number;
  valueUsd?: string | number;
  priceSource?: string;
  priceObservedAt?: string;
};

type AssetDashboard = {
  asOf: string;
  displayCurrency: string;
  totalValueUsd: string | number;
  unpricedAssetCount: number;
  oldestPriceObservedAt?: string;
  assets: AssetRow[];
  bySymbol: Array<unknown>;
};

type AssetSummary = {
  key: string;
  assetSymbol: string;
  kind: 'NATIVE' | 'TOKEN';
  chains: string[];
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  valueUsd?: number;
  addressCount: number;
  details: AssetRow[];
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
    to: '/console/chains',
  },
  {
    key: 'gasAccountFunded' as const,
    title: 'Fund a chain address',
    description: 'Confirmed native coins are automatically available for network fees.',
    to: '/console/chains',
  },
  {
    key: 'addressCreated' as const,
    title: 'Create a customer address',
    description: 'Test the same address-allocation flow your API will use.',
    to: '/console/addresses',
  },
];

export default function OverviewPage() {
  const session = useSession();
  const { t } = useI18n();
  const query = useApiQuery<OverviewData>(
    async (signal) => {
      if (!session) return { dashboard: emptyDashboard, webhooks: [], recent: [] };
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
    [session?.userId],
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
  const nativeAssets: AssetSummary[] = assets.filter((row) => row.nativeAsset).map((row) => ({
    key: `native:${row.chain}:${row.assetSymbol}`,
    assetSymbol: row.assetSymbol,
    kind: 'NATIVE',
    chains: [row.chain],
    availableBalance: Number(row.availableBalance),
    lockedBalance: Number(row.lockedBalance),
    totalBalance: Number(row.totalBalance),
    valueUsd: row.valueUsd === null || row.valueUsd === undefined ? undefined : Number(row.valueUsd),
    addressCount: row.addressCount,
    details: [row],
  }));
  const tokenAssets = [...assets.filter((row) => !row.nativeAsset)
    .reduce((groups, row) => {
      const current = groups.get(row.assetSymbol) ?? [];
      current.push(row);
      groups.set(row.assetSymbol, current);
      return groups;
    }, new Map<string, AssetRow[]>())]
    .map(([assetSymbol, details]): AssetSummary => {
      const priced = details.filter((row) => row.valueUsd !== null && row.valueUsd !== undefined);
      return {
        key: `token:${assetSymbol}`,
        assetSymbol,
        kind: 'TOKEN',
        chains: details.map((row) => row.chain),
        availableBalance: details.reduce((sum, row) => sum + Number(row.availableBalance), 0),
        lockedBalance: details.reduce((sum, row) => sum + Number(row.lockedBalance), 0),
        totalBalance: details.reduce((sum, row) => sum + Number(row.totalBalance), 0),
        valueUsd: priced.length
          ? priced.reduce((sum, row) => sum + Number(row.valueUsd), 0)
          : undefined,
        addressCount: details.reduce((sum, row) => sum + row.addressCount, 0),
        details,
      };
    });
  const assetDetails = [...nativeAssets, ...tokenAssets]
    .toSorted((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Asset overview')}
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

      {query.data?.onboarding ? (
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

      <section className="data-panel asset-details-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('Asset details')}</h2>
            <p>{t('Native assets and configured tokens are listed together. Expand a token to view balances by chain.')}</p>
          </div>
        </div>
        <Table<AssetSummary>
          rowKey="key"
          loading={query.loading}
          dataSource={assetDetails}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={t('No tenant assets enabled yet')} /> }}
          scroll={{ x: 1000 }}
          expandable={{
            rowExpandable: (row) => row.kind === 'TOKEN',
            expandRowByClick: true,
            expandedRowRender: (row) => (
              <Table<AssetRow>
                rowKey={(detail) => `${detail.chain}:${detail.assetSymbol}`}
                size="small"
                pagination={false}
                dataSource={row.details}
                columns={[
                  {
                    title: t('Chain'),
                    render: (_, detail) => (
                      <Space><ChainLogo chain={detail.chain} size={22} />{detail.chain}</Space>
                    ),
                  },
                  {
                    title: t('Total balance'),
                    align: 'right',
                    render: (_, detail) => `${formatAmount(detail.totalBalance)} ${detail.assetSymbol}`,
                  },
                  {
                    title: t('Available'),
                    align: 'right',
                    render: (_, detail) => `${formatAmount(detail.availableBalance)} ${detail.assetSymbol}`,
                  },
                  {
                    title: t('Locked'),
                    align: 'right',
                    render: (_, detail) => `${formatAmount(detail.lockedBalance)} ${detail.assetSymbol}`,
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
            ),
          }}
          columns={[
            {
              title: t('Asset'),
              width: 220,
              render: (_, row) => (
                <Space>
                  <AssetLogo symbol={row.assetSymbol} size={30} />
                  <Typography.Text strong>{row.assetSymbol}</Typography.Text>
                  <Tag color={row.kind === 'TOKEN' ? 'blue' : 'default'}>
                    {t(row.kind === 'TOKEN' ? 'Token' : 'Native asset')}
                  </Tag>
                </Space>
              ),
            },
            {
              title: t('Chains'),
              dataIndex: 'chains',
              render: (chains: string[]) => (
                <Space size={[4, 4]} wrap>
                  {chains.map((chain) => <Tag key={chain}>{chain}</Tag>)}
                </Space>
              ),
            },
            {
              title: t('Total balance'),
              align: 'right',
              sorter: (a, b) => a.totalBalance - b.totalBalance,
              render: (_, row) => `${formatAmount(row.totalBalance)} ${row.assetSymbol}`,
            },
            {
              title: t('USD value'),
              dataIndex: 'valueUsd',
              align: 'right',
              render: (value) => value === undefined ? '—' : `$${formatAmount(value)}`,
            },
            {
              title: t('Available'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.availableBalance)} ${row.assetSymbol}`,
            },
            {
              title: t('Locked'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.lockedBalance)} ${row.assetSymbol}`,
            },
            { title: t('Addresses'), dataIndex: 'addressCount', align: 'right' },
          ]}
        />
      </section>

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
    </div>
  );
}
