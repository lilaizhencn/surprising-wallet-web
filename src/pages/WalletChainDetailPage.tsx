import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { WalletChainForm, type WalletChainFormValues } from '../components/WalletChainForm';
import { ErrorState } from '../components/ErrorState';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletChain, WalletChainDetail, WalletRpcNode, WalletToken } from '../types/platform';
import { formatDate } from '../utils/format';
import { translateWalletConfigMessage } from '../utils/walletConfigMessage';
import { useI18n } from '../i18n';

type RpcFormValues = {
  environment: string;
  nodeLabel: string;
  purpose: string;
  connectionType: string;
  rpcUrl: string;
  authType: string;
  authHeaderName?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  priority: number;
  minRequestIntervalMs: number;
  enabled: boolean;
  remark?: string;
};

type TokenFormValues = {
  chain: string;
  network: string;
  symbol: string;
  standard: string;
  contractAddress: string;
  contractAddressBase58?: string;
  contractAddressHex?: string;
  decimals: number;
  enabled: boolean;
  collectEnabled: boolean;
  minDeposit?: string;
  minWithdraw?: string;
  collectThreshold?: string;
  gasStrategy?: string;
  confirmationRequired?: number;
};

const emptyValue = (value?: string | number | null) => value ?? '—';

export default function WalletChainDetailPage() {
  const { chainId } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [editChain, setEditChain] = useState(false);
  const [rpcOpen, setRpcOpen] = useState(false);
  const [editingRpc, setEditingRpc] = useState<WalletRpcNode>();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<WalletToken>();
  const [saving, setSaving] = useState(false);
  const [togglingRpcId, setTogglingRpcId] = useState<number>();
  const [chainForm] = Form.useForm<WalletChainFormValues>();
  const [switchForm] = Form.useForm();
  const [rpcForm] = Form.useForm<RpcFormValues>();
  const [tokenForm] = Form.useForm<TokenFormValues>();
  const endpoint = `/custody/platform/v1/wallet-config/chains/${chainId}`;

  const profilesQuery = useApiQuery<WalletChain[]>((signal) => session
    ? api.get('/custody/platform/v1/wallet-config/chains', session.token, signal)
    : Promise.resolve([]), [session?.token]);
  const query = useApiQuery<WalletChainDetail>((signal) => session
    ? api.get(endpoint, session.token, signal)
    : Promise.reject(new Error(t('Platform session is required'))), [session?.token, chainId, t]);

  const networkProfiles = useMemo(() => {
    if (!query.data) return [];
    return (profilesQuery.data ?? [])
      .filter((profile) => profile.chain === query.data?.chain.chain)
      .toSorted((left, right) => {
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
        if (left.network === 'mainnet') return -1;
        if (right.network === 'mainnet') return 1;
        return left.network.localeCompare(right.network);
      });
  }, [profilesQuery.data, query.data]);

  useEffect(() => {
    if (!query.data?.chain) return;
    switchForm.setFieldsValue(query.data.chain);
  }, [switchForm, query.data?.chain]);

  useEffect(() => {
    if (!editChain || !query.data?.chain) return;
    const chain = query.data.chain;
    chainForm.setFieldsValue({
      ...chain,
      explorerUrl: chain.explorerUrl ?? undefined,
      gasPolicy: chain.gasPolicy ?? undefined,
      chainId: chain.chainId ?? undefined,
      defaultFeeRate: chain.defaultFeeRate ?? undefined,
      dustThreshold: chain.dustThreshold ?? undefined,
    });
  }, [chainForm, editChain, query.data?.chain]);

  const refetchAll = () => {
    query.refetch();
    profilesQuery.refetch();
  };

  const saveChain = async () => {
    if (!session) return;
    const values = await chainForm.validateFields();
    setSaving(true);
    try {
      await api.patch(endpoint, session.token, values);
      await message.success(t('Chain profile updated'));
      setEditChain(false);
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update chain'));
    } finally {
      setSaving(false);
    }
  };

  const saveSwitches = async () => {
    if (!session || !query.data) return;
    const values = switchForm.getFieldsValue([
      'enabled', 'scanEnabled', 'withdrawEnabled', 'collectionEnabled', 'transferEnabled',
    ]);
    setSaving(true);
    try {
      await api.patch(`${endpoint}/switches`, session.token, values);
      await message.success(t('Chain switches updated'));
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update switches'));
    } finally {
      setSaving(false);
    }
  };

  const openRpc = (node?: WalletRpcNode) => {
    setEditingRpc(node);
    rpcForm.resetFields();
    rpcForm.setFieldsValue(node ? {
      environment: node.environment,
      nodeLabel: node.nodeLabel,
      purpose: node.purpose,
      connectionType: node.connectionType,
      rpcUrl: node.rpcUrl,
      authType: node.authType,
      authHeaderName: node.authHeaderName ?? undefined,
      priority: node.priority,
      minRequestIntervalMs: node.minRequestIntervalMs,
      enabled: node.enabled,
      remark: node.remark ?? undefined,
    } : {
      environment: query.data?.environment ?? 'dev',
      purpose: 'rpc',
      connectionType: 'HTTP_JSON_RPC',
      authType: 'NONE',
      priority: 100,
      minRequestIntervalMs: 0,
      enabled: false,
    });
    setRpcOpen(true);
  };

  const saveRpc = async () => {
    if (!session) return;
    const values = await rpcForm.validateFields();
    setSaving(true);
    try {
      if (editingRpc) {
        await api.patch(`${endpoint}/rpc-nodes/${editingRpc.id}`, session.token, values);
      } else {
        await api.post(`${endpoint}/rpc-nodes`, session.token, values);
      }
      await message.success(t(editingRpc ? 'RPC node updated' : 'RPC node created'));
      setRpcOpen(false);
      rpcForm.resetFields();
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save RPC node'));
    } finally {
      setSaving(false);
    }
  };

  const testRpc = async (node: WalletRpcNode) => {
    if (!session) return;
    try {
      const result = await api.post<{
        success: boolean;
        statusCode?: number;
        latencyMs: number;
        error?: string;
      }>(`${endpoint}/rpc-nodes/${node.id}/test`, session.token);
      if (result.success) {
        void message.success(t('RPC healthy · {latency} ms{status}', {
          latency: result.latencyMs,
          status: result.statusCode ? ` · HTTP ${result.statusCode}` : '',
        }));
      } else {
        void message.error(result.error
          ? t(result.error)
          : t('RPC test failed · {latency} ms', { latency: result.latencyMs }));
      }
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to test RPC node'));
    }
  };

  const toggleRpc = async (node: WalletRpcNode) => {
    if (!session) return;
    setTogglingRpcId(node.id);
    try {
      await api.patch(`${endpoint}/rpc-nodes/${node.id}`, session.token, { enabled: !node.enabled });
      await message.success(t(node.enabled ? 'RPC node disabled' : 'RPC node enabled'));
      refetchAll();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to update RPC node status';
      void message.error(translateWalletConfigMessage(detail, t));
    } finally {
      setTogglingRpcId(undefined);
    }
  };

  const deleteRpc = async (node: WalletRpcNode) => {
    if (!session) return;
    try {
      await api.delete(`${endpoint}/rpc-nodes/${node.id}`, session.token);
      await message.success(t('RPC node deleted'));
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to delete RPC node'));
    }
  };

  const openToken = (token?: WalletToken) => {
    if (!query.data) return;
    setEditingToken(token);
    tokenForm.resetFields();
    tokenForm.setFieldsValue(token ? {
      chain: token.chain,
      network: token.network,
      symbol: token.symbol,
      standard: token.standard,
      contractAddress: token.contractAddress,
      contractAddressBase58: token.contractAddressBase58 ?? undefined,
      contractAddressHex: token.contractAddressHex ?? undefined,
      decimals: token.decimals,
      enabled: token.enabled,
      collectEnabled: token.collectEnabled,
      minDeposit: token.minDeposit ?? undefined,
      minWithdraw: token.minWithdraw ?? undefined,
      collectThreshold: token.collectThreshold ?? undefined,
      gasStrategy: token.gasStrategy ?? undefined,
      confirmationRequired: token.confirmationRequired ?? undefined,
    } : {
      chain: query.data.chain.chain,
      network: query.data.chain.network,
      decimals: 18,
      enabled: false,
      collectEnabled: false,
    } as TokenFormValues);
    setTokenOpen(true);
  };

  const saveToken = async () => {
    if (!session) return;
    const values = await tokenForm.validateFields();
    setSaving(true);
    try {
      if (editingToken) {
        await api.patch(`/custody/platform/v1/wallet-config/tokens/${editingToken.id}`, session.token, values);
      } else {
        await api.post('/custody/platform/v1/wallet-config/tokens', session.token, values);
      }
      await message.success(t(editingToken ? 'Token updated' : 'Token created'));
      setTokenOpen(false);
      tokenForm.resetFields();
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save token'));
    } finally {
      setSaving(false);
    }
  };

  const toggleToken = async (token: WalletToken) => {
    if (!session) return;
    try {
      await api.patch(`/custody/platform/v1/wallet-config/tokens/${token.id}/status`, session.token, {
        enabled: !token.enabled,
      });
      await message.success(t(token.enabled ? 'Token disabled' : 'Token enabled'));
      refetchAll();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update token status'));
    }
  };

  const data = query.data;
  return (
    <div className="page-stack chain-management-page chain-detail-page">
      <header className="chain-detail-header">
        <div className="chain-detail-title">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            aria-label={t('Back to chains')}
            onClick={() => navigate('/platform/wallet-config/chains')}
          />
          {data ? <ChainLogo chain={data.chain.chain} size={52} /> : null}
          <div>
            <h1>{data?.chain.chain ?? t('Chain configuration')}</h1>
            <p>{t('Switch networks to manage configuration, RPC nodes, and tokens for this chain.')}</p>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refetchAll}>{t('Reload')}</Button>
          <Button icon={<EditOutlined />} onClick={() => setEditChain(true)} disabled={!data}>
            {t('Edit network profile')}
          </Button>
        </Space>
      </header>

      {data ? (
        <section className="chain-network-bar">
          <div>
            <span>{t('Network profile')}</span>
            <strong>{data.chain.network}</strong>
          </div>
          <Segmented
            value={Number(chainId)}
            options={networkProfiles.map((profile) => ({
              value: profile.id,
              label: (
                <span className="network-segment-label">
                  <i className={profile.enabled ? 'is-active' : ''} aria-hidden />
                  {profile.network}
                </span>
              ),
            }))}
            onChange={(profileId) => navigate(`/platform/wallet-config/chains/${profileId}`)}
          />
          <div className="chain-network-meta">
            <Tag color={data.chain.enabled ? 'green' : 'default'}>
              {t(data.chain.enabled ? 'Enabled' : 'Disabled')}
            </Tag>
            <span>{data.environment}</span>
          </div>
        </section>
      ) : null}

      <ErrorState message={query.error || profilesQuery.error} onRetry={refetchAll} />
      {data ? (
        <>
          <Alert
            type={data.checks.length ? 'warning' : 'success'}
            showIcon
            title={t(data.checks.length
              ? 'Configuration checks need attention'
              : 'Configuration checks passed')}
            description={data.checks.map((item) => t(item)).join(' ')
              || t('Runtime environment: {environment}', { environment: data.environment })}
          />

          <section className="data-panel chain-profile-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('Network configuration')}</Typography.Title>
                <Typography.Text type="secondary">
                  {t('Complete runtime parameters for the selected network profile.')}
                </Typography.Text>
              </div>
            </div>
            <Descriptions bordered size="small" column={4}>
              <Descriptions.Item label={t('Network')}>{data.chain.network}</Descriptions.Item>
              <Descriptions.Item label={t('Family')}>{data.chain.family}</Descriptions.Item>
              <Descriptions.Item label={t('Native asset')}>
                <span className="inline-asset"><AssetLogo symbol={data.chain.nativeSymbol} size={20} />{data.chain.nativeSymbol}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('EVM Chain ID')}>
                {data.chain.chainId ?? t('Not applicable for this chain family')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Runtime currency ID')}>{data.chain.runtimeCurrencyId}</Descriptions.Item>
              <Descriptions.Item label={t('BIP44 coin type')}>{data.chain.bip44CoinType}</Descriptions.Item>
              <Descriptions.Item label={t('Deposit confirmations')}>{data.chain.depositConfirmations}</Descriptions.Item>
              <Descriptions.Item label={t('Withdraw confirmations')}>{data.chain.withdrawConfirmations}</Descriptions.Item>
              <Descriptions.Item label={t('Default fee rate')}>{emptyValue(data.chain.defaultFeeRate)}</Descriptions.Item>
              <Descriptions.Item label={t('Dust threshold')}>{emptyValue(data.chain.dustThreshold)}</Descriptions.Item>
              <Descriptions.Item label={t('Gas policy')}>{emptyValue(data.chain.gasPolicy)}</Descriptions.Item>
              <Descriptions.Item label={t('Scan batch size')}>{data.chain.scanBatchSize}</Descriptions.Item>
              <Descriptions.Item label={t('Scan start height')}>{data.chain.scanStartHeight}</Descriptions.Item>
              <Descriptions.Item label={t('Max blocks per run')}>{data.chain.scanMaxBlocksPerRun}</Descriptions.Item>
              <Descriptions.Item label={t('Explorer URL')} span={2}>{emptyValue(data.chain.explorerUrl)}</Descriptions.Item>
              <Descriptions.Item label={t('Created')}>{formatDate(data.chain.createdAt)}</Descriptions.Item>
              <Descriptions.Item label={t('Updated')}>{formatDate(data.chain.updatedAt)}</Descriptions.Item>
            </Descriptions>
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('Runtime switches')}</Typography.Title>
                <Typography.Text type="secondary">
                  {t('Disabling the profile preserves its task configuration.')}
                </Typography.Text>
              </div>
              <Popconfirm title={t('Apply chain switches?')} onConfirm={saveSwitches}>
                <Button type="primary" loading={saving}>{t('Save switches')}</Button>
              </Popconfirm>
            </div>
            <Form form={switchForm} className="chain-switch-grid">
              {[
                ['enabled', 'Chain'],
                ['scanEnabled', 'Scan'],
                ['withdrawEnabled', 'Withdraw'],
                ['collectionEnabled', 'Collection'],
                ['transferEnabled', 'Transfer'],
              ].map(([name, label]) => (
                <Form.Item key={name} name={name} label={t(label)} valuePropName="checked">
                  <Switch />
                </Form.Item>
              ))}
            </Form>
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('RPC nodes')}</Typography.Title>
                <Typography.Text type="secondary">
                  {t('Credentials are write-only. Empty secret fields retain the stored value.')}
                </Typography.Text>
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openRpc()}>
                {t('Add RPC')}
              </Button>
            </div>
            <Table<WalletRpcNode>
              rowKey="id"
              dataSource={data.rpcNodes}
              pagination={false}
              locale={{ emptyText: <Empty description={t('No RPC nodes configured')} /> }}
              scroll={{ x: 1480 }}
              columns={[
                {
                  title: t('Node'),
                  width: 270,
                  render: (_, row) => (
                    <Space orientation="vertical" size={0}>
                      <Typography.Text strong>{row.nodeLabel}</Typography.Text>
                      <Typography.Text type="secondary" copyable={{ text: row.rpcUrl }} ellipsis>
                        {row.rpcUrl}
                      </Typography.Text>
                    </Space>
                  ),
                },
                { title: t('Environment'), dataIndex: 'environment', width: 110 },
                { title: t('Purpose'), dataIndex: 'purpose', width: 100 },
                { title: t('Connection type'), dataIndex: 'connectionType', width: 150 },
                { title: t('Priority'), dataIndex: 'priority', width: 85, align: 'center' },
                { title: t('Min interval (ms)'), dataIndex: 'minRequestIntervalMs', width: 130, align: 'right' },
                {
                  title: t('Auth'),
                  width: 170,
                  render: (_, row) => (
                    <>{row.authType}<br /><Typography.Text type="secondary">
                      {t(row.apiKeyConfigured || row.passwordConfigured
                        ? 'Credentials configured'
                        : 'No credentials')}
                    </Typography.Text></>
                  ),
                },
                {
                  title: t('Health'),
                  width: 130,
                  render: (_, row) => row.lastCheckedAt ? (
                    <><Tag color={row.lastError ? 'red' : 'green'}>
                      {t(row.lastError ? 'Failed' : 'Healthy')}
                    </Tag><br /><Typography.Text type="secondary">
                      {row.lastLatencyMs} ms{row.lastHttpStatus ? ` · HTTP ${row.lastHttpStatus}` : ''}
                    </Typography.Text></>
                  ) : t('Not tested'),
                },
                {
                  title: t('Status'),
                  dataIndex: 'enabled',
                  width: 100,
                  render: (value) => <Tag color={value ? 'green' : 'default'}>{t(value ? 'Enabled' : 'Disabled')}</Tag>,
                },
                {
                  title: t('Remark'),
                  dataIndex: 'remark',
                  width: 200,
                  ellipsis: true,
                  render: emptyValue,
                },
                {
                  title: t('Actions'),
                  fixed: 'right',
                  width: 340,
                  render: (_, row) => (
                    <Space>
                      <Button size="small" icon={<ExperimentOutlined />} onClick={() => testRpc(row)}>{t('Test')}</Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openRpc(row)}>{t('Edit')}</Button>
                      <Popconfirm
                        title={t(row.enabled ? 'Disable this RPC node?' : 'Enable this RPC node?')}
                        onConfirm={() => toggleRpc(row)}
                      >
                        <Button
                          size="small"
                          danger={row.enabled}
                          loading={togglingRpcId === row.id}
                        >
                          {t(row.enabled ? 'Disable' : 'Enable')}
                        </Button>
                      </Popconfirm>
                      <Popconfirm title={t('Delete this disabled RPC node?')} onConfirm={() => deleteRpc(row)}>
                        <Button size="small" danger icon={<DeleteOutlined />} disabled={row.enabled}>{t('Delete')}</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </section>

          <section className="data-panel">
            <div className="wallet-panel-heading">
              <div>
                <Typography.Title level={2}>{t('Tokens')}</Typography.Title>
                <Typography.Text type="secondary">
                  {t('Tokens are scoped to the selected chain and network profile.')}
                </Typography.Text>
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openToken()}>
                {t('Add token')}
              </Button>
            </div>
            <Table<WalletToken>
              rowKey="id"
              dataSource={data.tokens}
              pagination={false}
              locale={{ emptyText: <Empty description={t('No tokens configured for this network')} /> }}
              scroll={{ x: 1500 }}
              columns={[
                {
                  title: t('Token'),
                  fixed: 'left',
                  width: 180,
                  render: (_, row) => (
                    <div className="token-identity-cell">
                      <AssetLogo symbol={row.symbol} size={32} />
                      <div><strong>{row.symbol}</strong><span>{row.standard}</span></div>
                    </div>
                  ),
                },
                { title: t('Decimals'), dataIndex: 'decimals', width: 90, align: 'center' },
                { title: t('Contract'), dataIndex: 'contractAddress', width: 300, ellipsis: true },
                { title: t('Minimum deposit'), dataIndex: 'minDeposit', width: 130, render: emptyValue },
                { title: t('Minimum withdrawal'), dataIndex: 'minWithdraw', width: 140, render: emptyValue },
                { title: t('Collection threshold'), dataIndex: 'collectThreshold', width: 145, render: emptyValue },
                { title: t('Gas strategy'), dataIndex: 'gasStrategy', width: 150, render: emptyValue },
                { title: t('Confirmations'), dataIndex: 'confirmationRequired', width: 110, align: 'center', render: emptyValue },
                {
                  title: t('Configured'),
                  dataIndex: 'enabled',
                  width: 110,
                  render: (value) => <Tag color={value ? 'blue' : 'default'}>{t(value ? 'Enabled' : 'Disabled')}</Tag>,
                },
                {
                  title: t('Collection'),
                  dataIndex: 'collectEnabled',
                  width: 110,
                  render: (value) => <Tag color={value ? 'cyan' : 'default'}>{t(value ? 'On' : 'Off')}</Tag>,
                },
                {
                  title: t('Actual state'),
                  dataIndex: 'effectiveEnabled',
                  width: 170,
                  render: (value, row) => (
                    <Space orientation="vertical" size={0}>
                      <Tag color={value ? 'green' : 'default'}>{t(value ? 'Active' : 'Inactive')}</Tag>
                      {!value && row.blockers.length
                        ? <Typography.Text type="secondary" ellipsis>{row.blockers.map((item) => t(item)).join(' ')}</Typography.Text>
                        : null}
                    </Space>
                  ),
                },
                {
                  title: t('Actions'),
                  fixed: 'right',
                  width: 180,
                  render: (_, row) => (
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openToken(row)}>{t('Edit')}</Button>
                      <Popconfirm
                        title={t('{action} {symbol}?', {
                          action: t(row.enabled ? 'Disable' : 'Enable'),
                          symbol: row.symbol,
                        })}
                        onConfirm={() => toggleToken(row)}
                      >
                        <Button size="small">{t(row.enabled ? 'Disable' : 'Enable')}</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </section>
        </>
      ) : null}

      <Modal
        title={t('Edit chain profile')}
        open={editChain}
        width={1040}
        confirmLoading={saving}
        onOk={saveChain}
        onCancel={() => setEditChain(false)}
        destroyOnHidden
      >
        <Form form={chainForm} layout="vertical"><WalletChainForm switches={false} /></Form>
      </Modal>

      <Modal
        title={t(editingRpc ? 'Edit RPC node' : 'Add RPC node')}
        open={rpcOpen}
        width={860}
        confirmLoading={saving}
        onOk={saveRpc}
        onCancel={() => setRpcOpen(false)}
        destroyOnHidden
      >
        <Form form={rpcForm} layout="vertical" className="chain-editor-grid">
          <Form.Item name="environment" label={t('Environment')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="nodeLabel" label={t('Node label')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="purpose" label={t('Purpose')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="priority" label={t('Priority')} rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item name="connectionType" label={t('Connection type')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="authType" label={t('Auth type')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="authHeaderName" label={t('Auth header')}><Input /></Form.Item>
          <Form.Item name="minRequestIntervalMs" label={t('Min interval (ms)')} rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item className="chain-editor-span" name="rpcUrl" label={t('RPC URL')} rules={[{ required: true }, { type: 'url' }]}><Input /></Form.Item>
          <Form.Item name="apiKey" label={t(editingRpc?.apiKeyConfigured ? 'Replace API key' : 'API key')}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item name="username" label={t(editingRpc?.usernameConfigured ? 'Replace username' : 'Username')}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="password" label={t(editingRpc?.passwordConfigured ? 'Replace password' : 'Password')}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item name="enabled" label={t('Enabled')} valuePropName="checked"><Switch /></Form.Item>
          <Form.Item className="chain-editor-span" name="remark" label={t('Remark')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingToken ? t('Edit {symbol}', { symbol: editingToken.symbol }) : t('Add token')}
        open={tokenOpen}
        width={900}
        confirmLoading={saving}
        onOk={saveToken}
        onCancel={() => setTokenOpen(false)}
        destroyOnHidden
      >
        <Form form={tokenForm} layout="vertical" className="chain-editor-grid">
          <Form.Item name="chain" label={t('Chain')}><Input readOnly /></Form.Item>
          <Form.Item name="network" label={t('Network')}><Input readOnly /></Form.Item>
          <Form.Item name="symbol" label={t('Symbol')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="standard" label={t('Token standard')} rules={[{ required: true }]}><Input placeholder="ERC20" /></Form.Item>
          <Form.Item name="decimals" label={t('Decimals')} rules={[{ required: true }]}><InputNumber min={0} max={38} /></Form.Item>
          <Form.Item name="confirmationRequired" label={t('Confirmations')}><InputNumber min={0} /></Form.Item>
          <Form.Item className="chain-editor-span" name="contractAddress" label={t('Contract address')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contractAddressBase58" label={t('Base58 contract')}><Input /></Form.Item>
          <Form.Item name="contractAddressHex" label={t('Hex contract')}><Input /></Form.Item>
          <Form.Item name="gasStrategy" label={t('Gas strategy')}><Input /></Form.Item>
          <Form.Item name="minDeposit" label={t('Minimum deposit')}><Input /></Form.Item>
          <Form.Item name="minWithdraw" label={t('Minimum withdrawal')}><Input /></Form.Item>
          <Form.Item name="collectThreshold" label={t('Collection threshold')}><Input /></Form.Item>
          <Form.Item name="enabled" label={t('Enabled')} valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="collectEnabled" label={t('Collection enabled')} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
