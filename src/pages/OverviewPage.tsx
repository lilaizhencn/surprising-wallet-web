import { Alert, Button, Empty, Progress, Table, Typography } from 'antd';
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
import { useApiQuery } from '../hooks/useApiQuery';
import { formatAmount, formatDate } from '../utils/format';

type AssetRow = {
  chain: string;
  assetSymbol: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  addressCount: number;
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
  assets: AssetRow[];
  webhooks: WebhookRow[];
  recent: Array<TransferRow & { kind: 'Deposit' | 'Withdrawal' }>;
  onboarding?: OnboardingStatus;
};

type OnboardingStatus = {
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

const onboardingSteps = [
  {
    key: 'apiKeyConfigured' as const,
    title: 'Create an API key',
    description: 'Give your backend only the scopes it needs.',
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
    to: '/console/webhooks',
  },
  {
    key: 'gasAccountConfigured' as const,
    title: 'Create a gas reserve',
    description: 'Allocate a tenant-owned native-coin funding address.',
    to: '/console/gas-station',
  },
  {
    key: 'gasAccountFunded' as const,
    title: 'Fund the gas reserve',
    description: 'Wait for a confirmed native-coin deposit.',
    to: '/console/gas-station',
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
  const query = useApiQuery<OverviewData>(
    async (signal) => {
      if (!session) return { assets: [], webhooks: [], recent: [] };
      if (assetsOnly) {
        const assets = await api.get<AssetRow[]>('/custody/console/v1/assets', session.token, signal);
        return { assets, webhooks: [], recent: [] };
      }
      const [assets, webhooks, deposits, withdrawals, onboarding] = await Promise.all([
        api.get<AssetRow[]>('/custody/console/v1/assets', session.token, signal),
        api.get<WebhookRow[]>('/custody/console/v1/webhooks', session.token, signal),
        api.get<TransferRow[]>('/custody/console/v1/deposits?limit=5', session.token, signal),
        api.get<TransferRow[]>('/custody/console/v1/withdrawals?limit=5', session.token, signal),
        api.get<OnboardingStatus>('/custody/console/v1/onboarding', session.token, signal),
      ]);
      const recent = [
        ...deposits.map((row) => ({ ...row, kind: 'Deposit' as const })),
        ...withdrawals.map((row) => ({ ...row, kind: 'Withdrawal' as const })),
      ]
        .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8);
      return { assets, webhooks, recent, onboarding };
    },
    [session?.token, assetsOnly],
  );

  const assets = query.data?.assets ?? [];
  const totalAddresses = assets.reduce((sum, row) => sum + row.addressCount, 0);
  const activeAssets = assets.filter((row) => Number(row.totalBalance) !== 0).length;
  const degradedWebhooks = (query.data?.webhooks ?? []).filter(
    (row) => row.status !== 'ACTIVE' || (row.successRate24h ?? 100) < 95,
  );

  return (
    <div className="page-stack">
      <PageHeader
        title={assetsOnly ? 'Assets' : 'Asset overview'}
        description="Consolidated balances and activity across every configured chain."
      />
      <ErrorState message={query.error} onRetry={query.refetch} />

      {!assetsOnly && query.data?.onboarding ? (
        <section className="data-panel onboarding-panel">
          <div className="onboarding-heading">
            <div>
              <span className="eyebrow">Tenant activation</span>
              <h2>{query.data.onboarding.ready ? 'Ready for integration' : 'Finish your setup'}</h2>
              <p>
                Complete each operational control before sending production traffic.
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
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  <ArrowRightOutlined aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {!assetsOnly ? (
        <section className="overview-band" aria-label="Tenant asset summary">
          <div>
            <span>Tracked assets</span>
            <strong>{assets.length}</strong>
            <small>Tenant total</small>
          </div>
          <div>
            <span>Assets with balance</span>
            <strong>{activeAssets}</strong>
            <small>Across enabled networks</small>
          </div>
          <div>
            <span>Funded address links</span>
            <strong>{totalAddresses}</strong>
            <small>Distinct custody mappings</small>
          </div>
        </section>
      ) : null}

      <section className="data-panel">
        <div className="panel-heading"><h2>Assets</h2></div>
        <Table<AssetRow>
          rowKey={(row) => `${row.chain}:${row.assetSymbol}`}
          loading={query.loading}
          dataSource={assets}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No funded tenant assets yet" /> }}
          scroll={{ x: 860 }}
          columns={[
            {
              title: 'Asset',
              dataIndex: 'assetSymbol',
              render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
            },
            { title: 'Network', dataIndex: 'chain' },
            {
              title: 'Total balance',
              dataIndex: 'totalBalance',
              align: 'right',
              sorter: (a, b) => Number(a.totalBalance) - Number(b.totalBalance),
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            {
              title: 'Available',
              dataIndex: 'availableBalance',
              align: 'right',
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            {
              title: 'Locked',
              dataIndex: 'lockedBalance',
              align: 'right',
              render: (value, row) => `${formatAmount(value)} ${row.assetSymbol}`,
            },
            { title: 'Addresses', dataIndex: 'addressCount', align: 'right' },
            {
              title: 'Status',
              render: () => <StatusText value="ACTIVE" />,
            },
          ]}
        />
      </section>

      {!assetsOnly ? (
        <div className="overview-grid">
          <section className="data-panel">
            <div className="panel-heading">
              <h2>Recent custody activity</h2>
              <Link to="/console/deposits">View records <ArrowRightOutlined /></Link>
            </div>
            <Table
              rowKey="id"
              size="small"
              loading={query.loading}
              dataSource={query.data?.recent ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description="No custody activity yet" /> }}
              columns={[
                { title: 'Type', dataIndex: 'kind' },
                { title: 'Network', dataIndex: 'chain' },
                {
                  title: 'Amount',
                  render: (_, row) => `${formatAmount(row.amount)} ${row.assetSymbol}`,
                },
                { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                { title: 'Time', dataIndex: 'createdAt', render: formatDate },
              ]}
            />
          </section>
          <section className="data-panel">
            <div className="panel-heading">
              <h2>Webhook health</h2>
              <Link to="/console/webhooks"><LinkOutlined /> Manage webhooks</Link>
            </div>
            {degradedWebhooks.length ? (
              <Alert
                showIcon
                type="warning"
                title={`${degradedWebhooks.length} endpoint${degradedWebhooks.length > 1 ? 's need' : ' needs'} attention`}
              />
            ) : null}
            <Table<WebhookRow>
              rowKey="id"
              size="small"
              loading={query.loading}
              dataSource={query.data?.webhooks ?? []}
              pagination={false}
              locale={{ emptyText: <Empty description="No webhook endpoint configured" /> }}
              columns={[
                { title: 'Endpoint', dataIndex: 'name' },
                { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                {
                  title: 'Success (24h)',
                  dataIndex: 'successRate24h',
                  render: (value?: number) => value === null || value === undefined ? '—' : `${value.toFixed(1)}%`,
                },
                { title: 'Last delivery', dataIndex: 'lastDeliveryAt', render: formatDate },
              ]}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
