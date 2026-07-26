import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import {
  defaultChainValues,
  WalletChainForm,
  type WalletChainFormValues,
} from '../components/WalletChainForm';
import { useApiQuery } from '../hooks/useApiQuery';
import type {
  WalletChain,
  WalletChainDetail,
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
  nativeSymbol: string;
  configuredEnabled: boolean;
  profiles: WalletChainStatus[];
  representative: WalletChainStatus;
  tokenSymbols: string[];
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

const displayStatusPriority: Record<WalletChainStatus['status'], number> = {
  ACTIVE: 0,
  INACTIVE: 1,
  BLOCKED: 2,
  DISABLED: 3,
};

function groupChainStatuses(
  statuses: WalletChainStatus[],
  chainProfiles: WalletChain[],
  production: boolean,
): WalletChainStatusGroup[] {
  const grouped = new Map<string, WalletChainStatus[]>();
  const configsByChain = new Map<string, WalletChain[]>();
  statuses.forEach((status) => {
    const current = grouped.get(status.chain) ?? [];
    current.push(status);
    grouped.set(status.chain, current);
  });
  chainProfiles.forEach((profile) => {
    const current = configsByChain.get(profile.chain) ?? [];
    current.push(profile);
    configsByChain.set(profile.chain, current);
  });

  return [...grouped.entries()].map(([chain, profiles]) => {
    const sorted = profiles.toSorted((left, right) => {
      if (left.configuredEnabled !== right.configuredEnabled) return left.configuredEnabled ? -1 : 1;
      const leftHasTasks = taskDefinitions.some(({ key }) => left.configuredTasks[key]);
      const rightHasTasks = taskDefinitions.some(({ key }) => right.configuredTasks[key]);
      if (leftHasTasks !== rightHasTasks) return leftHasTasks ? -1 : 1;
      const leftMainnet = left.network === 'mainnet';
      const rightMainnet = right.network === 'mainnet';
      if (leftMainnet !== rightMainnet) {
        return production
          ? (leftMainnet ? -1 : 1)
          : (leftMainnet ? 1 : -1);
      }
      return left.network.localeCompare(right.network);
    });
    const enabledProfiles = sorted.filter((profile) => profile.configuredEnabled);
    const relevantProfiles = enabledProfiles.length ? enabledProfiles : [sorted[0]];
    const representative = relevantProfiles[0];
    const configuredProfiles = configsByChain.get(chain) ?? [];
    const tokenSymbols = [...new Set(
      configuredProfiles.flatMap((profile) => profile.tokenSymbols),
    )].toSorted((left, right) => left.localeCompare(right));
    const status = enabledProfiles.length
      ? relevantProfiles.reduce((current, profile) => (
        statusPriority[profile.status] > statusPriority[current] ? profile.status : current
      ), representative.status)
      : 'DISABLED';

    return {
      chain,
      family: sorted[0].family,
      nativeSymbol: configuredProfiles[0]?.nativeSymbol ?? representative.chain,
      configuredEnabled: enabledProfiles.length > 0,
      profiles: sorted,
      representative,
      tokenSymbols,
      enabledTokenCount: sorted.reduce((total, profile) => total + profile.enabledTokenCount, 0),
      enabledRpcNodeCount: sorted.reduce((total, profile) => total + profile.enabledRpcNodeCount, 0),
      status,
      blockers: [...new Set(relevantProfiles.flatMap((profile) => profile.blockers))],
    };
  }).toSorted((left, right) => {
    const statusDifference =
      displayStatusPriority[left.status] - displayStatusPriority[right.status];
    if (statusDifference !== 0) return statusDifference;
    if (left.configuredEnabled !== right.configuredEnabled) {
      return left.configuredEnabled ? -1 : 1;
    }
    return left.chain.localeCompare(right.chain);
  });
}

export default function WalletConfigOverviewPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [chainForm] = Form.useForm<WalletChainFormValues>();
  const [switches, setSwitches] = useState<WalletGlobalSwitches>();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingProfileId, setTogglingProfileId] = useState<number>();
  const query = useApiQuery<WalletConfigSummary>(
    (signal) => session
      ? api.get(endpoint, signal)
      : Promise.reject(new Error(t('Platform session is required'))),
    [session?.userId, t],
  );
  const profilesQuery = useApiQuery<WalletChain[]>(
    (signal) => session
      ? api.get('/custody/platform/v1/wallet-config/chains', signal)
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

  const chainGroups = useMemo(
    () => groupChainStatuses(
      query.data?.chains ?? [],
      profilesQuery.data ?? [],
      query.data?.production ?? false,
    ),
    [profilesQuery.data, query.data?.chains, query.data?.production],
  );
  const filteredChainGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return chainGroups;
    return chainGroups.filter((group) => [
      group.chain,
      group.family,
      group.nativeSymbol,
      ...group.profiles.map((profile) => profile.network),
      ...group.tokenSymbols,
    ].some((value) => value.toLowerCase().includes(keyword)));
  }, [chainGroups, search]);

  const refetchAll = () => {
    query.refetch();
    profilesQuery.refetch();
  };

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

  const createChain = async () => {
    const values = await chainForm.validateFields();
    setCreating(true);
    try {
      const created = await api.post<WalletChainDetail>(
        '/custody/platform/v1/wallet-config/chains',
        values,
      );
      void message.success(t('Chain profile created'));
      setCreateOpen(false);
      chainForm.resetFields();
      refetchAll();
      navigate(`/platform/wallet-config/chains/${created.chain.id}`);
    } catch (error) {
      void message.error(
        translateWalletConfigMessage(
          error instanceof Error ? error.message : 'Unable to create chain profile',
          t,
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleChain = async (row: WalletChainStatusGroup) => {
    const profile = row.representative;
    setTogglingProfileId(profile.profileId);
    try {
      await api.patch(
        `/custody/platform/v1/wallet-config/chains/${profile.profileId}/switches`,
        {
          enabled: !row.configuredEnabled,
          scanEnabled: profile.configuredTasks.scanEnabled,
          withdrawEnabled: profile.configuredTasks.withdrawEnabled,
          collectionEnabled: profile.configuredTasks.collectionEnabled,
          transferEnabled: profile.configuredTasks.transferEnabled,
        },
      );
      void message.success(t(row.configuredEnabled ? 'Chain disabled' : 'Chain enabled'));
      refetchAll();
    } catch (error) {
      void message.error(
        translateWalletConfigMessage(
          error instanceof Error ? error.message : 'Unable to update chain switches',
          t,
        ),
      );
    } finally {
      setTogglingProfileId(undefined);
    }
  };

  const chainColumns = [
    {
      title: t('Chain'),
      key: 'chain',
      width: 210,
      render: (_: unknown, row: WalletChainStatusGroup) => (
        <div className="chain-cell">
          <ChainLogo chain={row.chain} size={34} />
          <div>
            <Typography.Text strong>{row.chain}</Typography.Text>
            <br />
            <Typography.Text type="secondary">
              {row.nativeSymbol} · {row.family}
            </Typography.Text>
          </div>
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
      title: t('Supported tokens'),
      key: 'supportedTokens',
      width: 230,
      render: (_: unknown, row: WalletChainStatusGroup) => {
        const symbols = row.tokenSymbols.length ? row.tokenSymbols : [row.nativeSymbol];
        return (
          <Space size={[4, 4]} wrap>
            {symbols.slice(0, 5).map((symbol) => (
              <Tag key={symbol} icon={<AssetLogo symbol={symbol} size={14} />}>
                {symbol}
              </Tag>
            ))}
            {symbols.length > 5 ? <Tag>+{symbols.length - 5}</Tag> : null}
          </Space>
        );
      },
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
    {
      title: t('Operations'),
      key: 'operations',
      fixed: 'right' as const,
      width: 210,
      onCell: () => ({
        onClick: (event: MouseEvent) => event.stopPropagation(),
      }),
      render: (_: unknown, row: WalletChainStatusGroup) => (
        <Space>
          <Popconfirm
            title={`${t(row.configuredEnabled ? 'Disable' : 'Enable')} ${row.chain} / ${row.representative.network}?`}
            onConfirm={() => toggleChain(row)}
          >
            <Button
              size="small"
              danger={row.configuredEnabled}
              loading={togglingProfileId === row.representative.profileId}
            >
              {t(row.configuredEnabled ? 'Disable' : 'Enable')}
            </Button>
          </Popconfirm>
          <Button
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate(`/platform/wallet-config/chains/${row.representative.profileId}`)}
          >
            {t('Open chain')}
          </Button>
        </Space>
      ),
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
        actions={(
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={refetchAll}
              loading={query.loading || profilesQuery.loading}
            >
              {t('Reload')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                chainForm.setFieldsValue(defaultChainValues);
                setCreateOpen(true);
              }}
            >
              {t('Add chain profile')}
            </Button>
          </Space>
        )}
      />
      <ErrorState message={query.error || profilesQuery.error} onRetry={refetchAll} />
      {(query.loading || profilesQuery.loading) && (!data || !profilesQuery.data)
        ? <section className="data-panel wallet-config-loading"><Spin /></section>
        : null}
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
                <Typography.Text type="secondary">{t('Ready chains are shown first; configured values and effective task state are shown separately.')}</Typography.Text>
              </div>
            </div>
            <div className="chain-search-bar">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('Search chains, networks, or tokens')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Typography.Text type="secondary">
                {filteredChainGroups.length} / {chainGroups.length} {t('chains')}
              </Typography.Text>
            </div>
            <Table<WalletChainStatusGroup>
              rowKey="chain"
              columns={chainColumns}
              dataSource={filteredChainGroups}
              loading={query.loading || profilesQuery.loading}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 1800 }}
              locale={{ emptyText: <Empty description={t('No chains found')} /> }}
              onRow={(row) => ({
                onClick: () => navigate(`/platform/wallet-config/chains/${row.representative.profileId}`),
                style: { cursor: 'pointer' },
              })}
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
      <Modal
        open={createOpen}
        title={t('Add chain profile')}
        width={1040}
        confirmLoading={creating}
        onOk={createChain}
        onCancel={() => {
          setCreateOpen(false);
          chainForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form form={chainForm} layout="vertical" initialValues={defaultChainValues}>
          <WalletChainForm />
        </Form>
      </Modal>
    </div>
  );
}
