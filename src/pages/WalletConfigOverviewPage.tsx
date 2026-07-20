import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Popconfirm,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type {
  WalletChainStatus,
  WalletConfigAnomaly,
  WalletConfigSummary,
  WalletGlobalSwitches,
  WalletTaskSwitches,
} from '../types/platform';

const endpoint = '/custody/platform/v1/wallet-config/summary';

const switchDefinitions: Array<{
  key: keyof WalletGlobalSwitches;
  label: string;
  description: string;
}> = [
  { key: 'walletEnabled', label: 'Wallet master', description: 'Controls every wallet runtime task.' },
  { key: 'scanEnabled', label: 'Scanning', description: 'Controls all chain scanners.' },
  { key: 'withdrawEnabled', label: 'Withdrawals', description: 'Controls withdrawal processing.' },
  { key: 'collectionEnabled', label: 'Collection', description: 'Controls asset collection jobs.' },
  { key: 'transferEnabled', label: 'Transfers', description: 'Controls internal wallet transfers.' },
];

const taskDefinitions: Array<{ key: keyof WalletTaskSwitches; label: string }> = [
  { key: 'scanEnabled', label: 'Scan' },
  { key: 'withdrawEnabled', label: 'Withdraw' },
  { key: 'collectionEnabled', label: 'Collect' },
  { key: 'transferEnabled', label: 'Transfer' },
];

function TaskTags({ tasks }: { tasks: WalletTaskSwitches }) {
  return (
    <Space size={[4, 4]} wrap>
      {taskDefinitions.map((task) => (
        <Tag key={task.key} color={tasks[task.key] ? 'green' : 'default'}>
          {task.label}
        </Tag>
      ))}
    </Space>
  );
}

function statusColor(status: WalletChainStatus['status']) {
  if (status === 'ACTIVE') return 'green';
  if (status === 'BLOCKED') return 'red';
  if (status === 'INACTIVE') return 'gold';
  return 'default';
}

export default function WalletConfigOverviewPage() {
  const session = useSession();
  const { message } = App.useApp();
  const [switches, setSwitches] = useState<WalletGlobalSwitches>();
  const [saving, setSaving] = useState(false);
  const query = useApiQuery<WalletConfigSummary>(
    (signal) => session
      ? api.get(endpoint, session.token, signal)
      : Promise.reject(new Error('Platform session is required')),
    [session?.token],
  );

  useEffect(() => {
    if (query.data) setSwitches(query.data.globalSwitches);
  }, [query.data]);

  const changed = useMemo(
    () => Boolean(query.data && switches
      && switchDefinitions.some(({ key }) => switches[key] !== query.data?.globalSwitches[key])),
    [query.data, switches],
  );

  const saveSwitches = async () => {
    if (!session || !switches) return;
    setSaving(true);
    try {
      await api.patch<WalletConfigSummary>(
        '/custody/platform/v1/wallet-config/global-switches',
        session.token,
        switches,
      );
      await message.success('Global wallet switches updated');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to update global switches');
    } finally {
      setSaving(false);
    }
  };

  const chainColumns = [
    {
      title: 'Chain / network',
      key: 'chain',
      render: (_: unknown, row: WalletChainStatus) => (
        <div>
          <Typography.Text strong>{row.chain}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{row.network} · {row.family}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: WalletChainStatus['status']) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Configured tasks',
      dataIndex: 'configuredTasks',
      render: (tasks: WalletTaskSwitches) => <TaskTags tasks={tasks} />,
    },
    {
      title: 'Effective tasks',
      dataIndex: 'effectiveTasks',
      render: (tasks: WalletTaskSwitches) => <TaskTags tasks={tasks} />,
    },
    { title: 'Tokens', dataIndex: 'enabledTokenCount', width: 84 },
    { title: 'RPC', dataIndex: 'enabledRpcNodeCount', width: 72 },
    {
      title: 'Blocking reason',
      dataIndex: 'blockers',
      render: (blockers: string[]) => blockers.length
        ? <Typography.Text type="secondary">{blockers.join(' ')}</Typography.Text>
        : <Typography.Text type="success">Ready</Typography.Text>,
    },
  ];

  const anomalyColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 100,
      render: (severity: WalletConfigAnomaly['severity']) => (
        <Tag color={severity === 'ERROR' ? 'red' : 'gold'}>{severity}</Tag>
      ),
    },
    {
      title: 'Scope',
      key: 'scope',
      width: 170,
      render: (_: unknown, row: WalletConfigAnomaly) => (
        [row.chain, row.network].filter(Boolean).join(' / ') || 'Global'
      ),
    },
    { title: 'Issue', dataIndex: 'message' },
  ];

  const data = query.data;
  return (
    <div className="page-stack">
      <PageHeader
        title="Wallet configuration"
        description="Global runtime state, enabled resources, and configuration health."
        actions={<Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button>}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {query.loading && !data ? <section className="data-panel wallet-config-loading"><Spin /></section> : null}
      {data ? (
        <>
          <Alert
            type={data.production ? 'warning' : 'info'}
            showIcon
            title={`${data.environment} environment`}
            description={data.production
              ? 'Production permits only one enabled network per chain and only production networks.'
              : 'Test environments may store devnet and testnet profiles; enable one network per chain at a time.'}
          />

          <div className="tenant-metric-grid">
            <div className="metric-card"><Statistic title="Enabled chains" value={data.statistics.enabledChainCount} /></div>
            <div className="metric-card"><Statistic title="Enabled networks" value={data.statistics.enabledNetworkCount} /></div>
            <div className="metric-card"><Statistic title="Enabled tokens" value={data.statistics.enabledTokenCount} /></div>
            <div className="metric-card"><Statistic title={`RPC nodes · ${data.environment}`} value={data.statistics.enabledRpcNodeCount} /></div>
            <div className="metric-card"><Statistic title="Chain profiles" value={data.statistics.configuredChainProfileCount} /></div>
            <div className="metric-card">
              <Statistic
                title="Configuration issues"
                value={data.statistics.anomalyCount}
                styles={{ content: data.statistics.anomalyCount ? { color: '#b42318' } : {} }}
              />
            </div>
          </div>

          <section className="data-panel wallet-switch-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>Global switches</Typography.Title>
                <Typography.Text type="secondary">Changes take effect immediately after saving.</Typography.Text>
              </div>
              <Popconfirm
                title="Apply global wallet switches?"
                description="Wallet runtime behavior changes immediately."
                okText="Apply"
                onConfirm={saveSwitches}
                disabled={!changed}
              >
                <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!changed}>
                  Save switches
                </Button>
              </Popconfirm>
            </div>
            <div className="wallet-switch-grid">
              {switches ? switchDefinitions.map((definition) => (
                <div key={definition.key} className="wallet-switch-item">
                  <div>
                    <Typography.Text strong>{definition.label}</Typography.Text>
                    <Typography.Text type="secondary">{definition.description}</Typography.Text>
                  </div>
                  <Switch
                    checked={switches[definition.key]}
                    onChange={(checked) => setSwitches((current) => current
                      ? { ...current, [definition.key]: checked }
                      : current)}
                  />
                </div>
              )) : null}
            </div>
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>Chain runtime status</Typography.Title>
                <Typography.Text type="secondary">Configured values and effective task state are shown separately.</Typography.Text>
              </div>
            </div>
            <Table<WalletChainStatus>
              rowKey="profileId"
              columns={chainColumns}
              dataSource={data.chains}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 1100 }}
            />
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>Configuration issues</Typography.Title>
                <Typography.Text type="secondary">Cross-table and environment checks from the current database state.</Typography.Text>
              </div>
            </div>
            <Table<WalletConfigAnomaly>
              rowKey={(row) => `${row.code}-${row.chain ?? ''}-${row.network ?? ''}-${row.message}`}
              columns={anomalyColumns}
              dataSource={data.anomalies}
              pagination={false}
              locale={{ emptyText: 'No configuration issues' }}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
