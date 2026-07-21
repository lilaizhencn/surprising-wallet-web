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
import { useI18n } from '../i18n';
import { translateWalletConfigMessage } from '../utils/walletConfigMessage';

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
  const { t } = useI18n();
  return (
    <Space size={[4, 4]} wrap>
      {taskDefinitions.map((task) => (
        <Tag key={task.key} color={tasks[task.key] ? 'green' : 'default'}>
          {t(task.label)}
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

type WalletChainStatusGroup = {
  chain: string;
  family: string;
  profiles: WalletChainStatus[];
  representative: WalletChainStatus;
  enabledTokenCount: number;
  enabledRpcNodeCount: number;
  status: WalletChainStatus['status'];
  blockers: string[];
};

const statusPriority: Record<WalletChainStatus['status'], number> = {
  BLOCKED: 4,
  INACTIVE: 3,
  ACTIVE: 2,
  DISABLED: 1,
};

function groupChainStatuses(statuses: WalletChainStatus[]): WalletChainStatusGroup[] {
  const grouped = new Map<string, WalletChainStatus[]>();
  statuses.forEach((status) => {
    const current = grouped.get(status.chain) ?? [];
    current.push(status);
    grouped.set(status.chain, current);
  });

  return [...grouped.entries()].map(([chain, profiles]) => {
    const sorted = profiles.toSorted((left, right) => {
      if (left.configuredEnabled !== right.configuredEnabled) return left.configuredEnabled ? -1 : 1;
      if (left.network === 'mainnet') return -1;
      if (right.network === 'mainnet') return 1;
      return left.network.localeCompare(right.network);
    });
    const enabledProfiles = sorted.filter((profile) => profile.configuredEnabled);
    const relevantProfiles = enabledProfiles.length ? enabledProfiles : [sorted[0]];
    const representative = relevantProfiles[0];
    const status = enabledProfiles.length
      ? relevantProfiles.reduce((current, profile) => (
        statusPriority[profile.status] > statusPriority[current] ? profile.status : current
      ), representative.status)
      : 'DISABLED';

    return {
      chain,
      family: sorted[0].family,
      profiles: sorted,
      representative,
      enabledTokenCount: sorted.reduce((total, profile) => total + profile.enabledTokenCount, 0),
      enabledRpcNodeCount: sorted.reduce((total, profile) => total + profile.enabledRpcNodeCount, 0),
      status,
      blockers: [...new Set(relevantProfiles.flatMap((profile) => profile.blockers))],
    };
  }).toSorted((left, right) => left.chain.localeCompare(right.chain));
}

export default function WalletConfigOverviewPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [switches, setSwitches] = useState<WalletGlobalSwitches>();
  const [saving, setSaving] = useState(false);
  const query = useApiQuery<WalletConfigSummary>(
    (signal) => session
      ? api.get(endpoint, signal)
      : Promise.reject(new Error(t('Platform session is required'))),
    [session?.userId, t],
  );

  useEffect(() => {
    if (query.data) setSwitches(query.data.globalSwitches);
  }, [query.data]);

  const changed = useMemo(
    () => Boolean(query.data && switches
      && switchDefinitions.some(({ key }) => switches[key] !== query.data?.globalSwitches[key])),
    [query.data, switches],
  );

  const chainGroups = useMemo(() => groupChainStatuses(query.data?.chains ?? []), [query.data?.chains]);

  const saveSwitches = async () => {
    if (!session || !switches) return;
    setSaving(true);
    try {
      await api.patch<WalletConfigSummary>(
        '/custody/platform/v1/wallet-config/global-switches',
        switches,
      );
      await message.success(t('Global wallet switches updated'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update global switches'));
    } finally {
      setSaving(false);
    }
  };

  const chainColumns = [
    {
      title: t('Chain'),
      key: 'chain',
      render: (_: unknown, row: WalletChainStatusGroup) => (
        <div>
          <Typography.Text strong>{row.chain}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{row.family}</Typography.Text>
        </div>
      ),
    },
    {
      title: t('Networks'),
      key: 'networks',
      render: (_: unknown, row: WalletChainStatusGroup) => (
        <div className="chain-network-list">
          {row.profiles.map((profile) => (
            <Tag key={profile.profileId} color={profile.configuredEnabled ? 'green' : 'default'}>
              {profile.configuredEnabled ? <i aria-hidden /> : null}
              {profile.network}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: t('Status'),
      dataIndex: 'status',
      render: (status: WalletChainStatus['status']) => <Tag color={statusColor(status)}>{t(status.charAt(0) + status.slice(1).toLowerCase())}</Tag>,
    },
    {
      title: t('Configured tasks'),
      key: 'configuredTasks',
      render: (_: unknown, row: WalletChainStatusGroup) => <TaskTags tasks={row.representative.configuredTasks} />,
    },
    {
      title: t('Effective tasks'),
      key: 'effectiveTasks',
      render: (_: unknown, row: WalletChainStatusGroup) => <TaskTags tasks={row.representative.effectiveTasks} />,
    },
    { title: t('Tokens'), dataIndex: 'enabledTokenCount', width: 84 },
    { title: 'RPC', dataIndex: 'enabledRpcNodeCount', width: 72 },
    {
      title: t('Blocking reason'),
      dataIndex: 'blockers',
      render: (blockers: string[]) => blockers.length
        ? <Typography.Text type="secondary">{blockers.map((item) => translateWalletConfigMessage(item, t)).join(' ')}</Typography.Text>
        : <Typography.Text type="success">{t('Ready')}</Typography.Text>,
    },
  ];

  const anomalyColumns = [
    {
      title: t('Severity'),
      dataIndex: 'severity',
      width: 100,
      render: (severity: WalletConfigAnomaly['severity']) => (
        <Tag color={severity === 'ERROR' ? 'red' : 'gold'}>{t(severity === 'ERROR' ? 'Error' : 'Warning')}</Tag>
      ),
    },
    {
      title: t('Scope'),
      key: 'scope',
      width: 170,
      render: (_: unknown, row: WalletConfigAnomaly) => (
        [row.chain, row.network].filter(Boolean).join(' / ') || t('Global')
      ),
    },
    {
      title: t('Issue'),
      dataIndex: 'message',
      render: (value: string) => translateWalletConfigMessage(value, t),
    },
  ];

  const data = query.data;
  return (
    <div className="page-stack">
      <PageHeader
        title={t('Wallet configuration')}
        description={t('Global runtime state, enabled resources, and configuration health.')}
        actions={<Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button>}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {query.loading && !data ? <section className="data-panel wallet-config-loading"><Spin /></section> : null}
      {data ? (
        <>
          <Alert
            type={data.production ? 'warning' : 'info'}
            showIcon
            title={t('{environment} environment', { environment: data.environment })}
            description={data.production
              ? t('Production permits only one enabled network per chain and only production networks.')
              : t('Test environments may store devnet and testnet profiles; enable one network per chain at a time.')}
          />

          <div className="tenant-metric-grid">
            <div className="metric-card"><Statistic title={t('Enabled chains')} value={data.statistics.enabledChainCount} /></div>
            <div className="metric-card"><Statistic title={t('Enabled networks')} value={data.statistics.enabledNetworkCount} /></div>
            <div className="metric-card"><Statistic title={t('Enabled tokens')} value={data.statistics.enabledTokenCount} /></div>
            <div className="metric-card"><Statistic title={t('RPC nodes · {environment}', { environment: data.environment })} value={data.statistics.enabledRpcNodeCount} /></div>
            <div className="metric-card"><Statistic title={t('Chain profiles')} value={data.statistics.configuredChainProfileCount} /></div>
            <div className="metric-card">
              <Statistic
                title={t('Configuration issues')}
                value={data.statistics.anomalyCount}
                styles={{ content: data.statistics.anomalyCount ? { color: '#b42318' } : {} }}
              />
            </div>
          </div>

          <section className="data-panel wallet-switch-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('Global switches')}</Typography.Title>
                <Typography.Text type="secondary">{t('Changes take effect immediately after saving.')}</Typography.Text>
              </div>
              <Popconfirm
                title={t('Apply global wallet switches?')}
                description={t('Wallet runtime behavior changes immediately.')}
                okText={t('Apply')}
                onConfirm={saveSwitches}
                disabled={!changed}
              >
                <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!changed}>
                  {t('Save switches')}
                </Button>
              </Popconfirm>
            </div>
            <div className="wallet-switch-grid">
              {switches ? switchDefinitions.map((definition) => (
                <div key={definition.key} className="wallet-switch-item">
                  <div>
                    <Typography.Text strong>{t(definition.label)}</Typography.Text>
                    <Typography.Text type="secondary">{t(definition.description)}</Typography.Text>
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
                <Typography.Title level={2}>{t('Chain runtime status')}</Typography.Title>
                <Typography.Text type="secondary">{t('Configured values and effective task state are shown separately.')}</Typography.Text>
              </div>
            </div>
            <Table<WalletChainStatusGroup>
              rowKey="chain"
              columns={chainColumns}
              dataSource={chainGroups}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 1100 }}
            />
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('Configuration issues')}</Typography.Title>
                <Typography.Text type="secondary">{t('Cross-table and environment checks from the current database state.')}</Typography.Text>
              </div>
            </div>
            <Table<WalletConfigAnomaly>
              rowKey={(row) => `${row.code}-${row.chain ?? ''}-${row.network ?? ''}-${row.message}`}
              columns={anomalyColumns}
              dataSource={data.anomalies}
              pagination={false}
              locale={{ emptyText: t('No configuration issues') }}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
