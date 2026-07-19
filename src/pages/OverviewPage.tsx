import { Alert, Button, Empty, Table, Typography } from 'antd';
import { ArrowRightOutlined, LinkOutlined } from '@ant-design/icons';
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
};

export default function OverviewPage({ assetsOnly = false }: { assetsOnly?: boolean }) {
  const session = useSession();
  const query = useApiQuery<OverviewData>(
    async (signal) => {
      if (!session) return { assets: [], webhooks: [], recent: [] };
      if (assetsOnly) {
        const assets = await api.get<AssetRow[]>('/custody/console/v1/assets', session.token, signal);
        return { assets, webhooks: [], recent: [] };
      }
      const [assets, webhooks, deposits, withdrawals] = await Promise.all([
        api.get<AssetRow[]>('/custody/console/v1/assets', session.token, signal),
        api.get<WebhookRow[]>('/custody/console/v1/webhooks', session.token, signal),
        api.get<TransferRow[]>('/custody/console/v1/deposits?limit=5', session.token, signal),
        api.get<TransferRow[]>('/custody/console/v1/withdrawals?limit=5', session.token, signal),
      ]);
      const recent = [
        ...deposits.map((row) => ({ ...row, kind: 'Deposit' as const })),
        ...withdrawals.map((row) => ({ ...row, kind: 'Withdrawal' as const })),
      ]
        .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8);
      return { assets, webhooks, recent };
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
                message={`${degradedWebhooks.length} endpoint${degradedWebhooks.length > 1 ? 's need' : ' needs'} attention`}
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
