import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Descriptions, Form, Input, InputNumber, Modal,
  Popconfirm, Space, Switch, Table, Tag, Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, ExperimentOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { WalletChainForm, type WalletChainFormValues } from '../components/WalletChainForm';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletChainDetail, WalletRpcNode } from '../types/platform';

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

export default function WalletChainDetailPage() {
  const { chainId } = useParams();
  const session = useSession();
  const { message } = App.useApp();
  const [editChain, setEditChain] = useState(false);
  const [rpcOpen, setRpcOpen] = useState(false);
  const [editingRpc, setEditingRpc] = useState<WalletRpcNode>();
  const [saving, setSaving] = useState(false);
  const [chainForm] = Form.useForm<WalletChainFormValues>();
  const [switchForm] = Form.useForm();
  const [rpcForm] = Form.useForm<RpcFormValues>();
  const endpoint = `/custody/platform/v1/wallet-config/chains/${chainId}`;
  const query = useApiQuery<WalletChainDetail>((signal) => session
    ? api.get(endpoint, session.token, signal)
    : Promise.reject(new Error('Platform session is required')), [session?.token, chainId]);

  useEffect(() => {
    if (query.data?.chain) {
      const chain = query.data.chain;
      chainForm.setFieldsValue({
        ...chain,
        explorerUrl: chain.explorerUrl ?? undefined,
        gasPolicy: chain.gasPolicy ?? undefined,
        chainId: chain.chainId ?? undefined,
        defaultFeeRate: chain.defaultFeeRate ?? undefined,
        dustThreshold: chain.dustThreshold ?? undefined,
      });
      switchForm.setFieldsValue(chain);
    }
  }, [chainForm, switchForm, query.data?.chain]);

  const saveChain = async () => {
    if (!session) return;
    const values = await chainForm.validateFields();
    setSaving(true);
    try {
      await api.patch(endpoint, session.token, values);
      await message.success('Chain profile updated');
      setEditChain(false);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to update chain');
    } finally { setSaving(false); }
  };

  const saveSwitches = async () => {
    if (!session || !query.data) return;
    const values = switchForm.getFieldsValue([
      'enabled', 'scanEnabled', 'withdrawEnabled', 'collectionEnabled', 'transferEnabled',
    ]);
    setSaving(true);
    try {
      await api.patch(`${endpoint}/switches`, session.token, values);
      await message.success('Chain switches updated');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to update switches');
    } finally { setSaving(false); }
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
      apiKey: undefined,
      username: undefined,
      password: undefined,
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
      await message.success(`RPC node ${editingRpc ? 'updated' : 'created'}`);
      setRpcOpen(false);
      rpcForm.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to save RPC node');
    } finally { setSaving(false); }
  };

  const testRpc = async (node: WalletRpcNode) => {
    if (!session) return;
    try {
      const result = await api.post<{ success: boolean; statusCode?: number; latencyMs: number; error?: string }>(
        `${endpoint}/rpc-nodes/${node.id}/test`, session.token,
      );
      if (result.success) void message.success(`RPC healthy · ${result.latencyMs} ms${result.statusCode ? ` · HTTP ${result.statusCode}` : ''}`);
      else void message.error(result.error || `RPC test failed · ${result.latencyMs} ms`);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to test RPC node');
    }
  };

  const deleteRpc = async (node: WalletRpcNode) => {
    if (!session) return;
    try {
      await api.delete(`${endpoint}/rpc-nodes/${node.id}`, session.token);
      await message.success('RPC node deleted');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to delete RPC node');
    }
  };

  const data = query.data;
  return (
    <div className="page-stack">
      <PageHeader
        title={data ? `${data.chain.chain} · ${data.chain.network}` : 'Chain configuration'}
        description="Chain settings, runtime switches, RPC nodes and configured tokens."
        actions={<Space><Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button><Button icon={<EditOutlined />} onClick={() => setEditChain(true)} disabled={!data}>Edit profile</Button></Space>}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {data ? (
        <>
          <Alert type={data.checks.length ? 'warning' : 'success'} showIcon title={data.checks.length ? 'Configuration checks need attention' : 'Configuration checks passed'} description={data.checks.join(' ') || `Runtime environment: ${data.environment}`} />
          <section className="data-panel">
            <Descriptions title="Profile" column={3}>
              <Descriptions.Item label="Family">{data.chain.family}</Descriptions.Item>
              <Descriptions.Item label="Native asset">{data.chain.nativeSymbol}</Descriptions.Item>
              <Descriptions.Item label="Runtime currency ID">{data.chain.runtimeCurrencyId}</Descriptions.Item>
              <Descriptions.Item label="BIP44 coin type">{data.chain.bip44CoinType}</Descriptions.Item>
              <Descriptions.Item label="Chain ID">{data.chain.chainId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Confirmations">{data.chain.depositConfirmations} deposit / {data.chain.withdrawConfirmations} withdraw</Descriptions.Item>
            </Descriptions>
          </section>
          <section className="data-panel">
            <div className="wallet-panel-heading"><div><Typography.Title level={2}>Runtime switches</Typography.Title><Typography.Text type="secondary">Disabling the profile preserves its task configuration.</Typography.Text></div><Popconfirm title="Apply chain switches?" onConfirm={saveSwitches}><Button type="primary" loading={saving}>Save switches</Button></Popconfirm></div>
            <Form form={switchForm} layout="inline">
              {[
                ['enabled', 'Chain'], ['scanEnabled', 'Scan'], ['withdrawEnabled', 'Withdraw'],
                ['collectionEnabled', 'Collection'], ['transferEnabled', 'Transfer'],
              ].map(([name, label]) => <Form.Item key={name} name={name} label={label} valuePropName="checked"><Switch /></Form.Item>)}
            </Form>
          </section>
          <section className="data-panel">
            <div className="wallet-panel-heading"><div><Typography.Title level={2}>RPC nodes</Typography.Title><Typography.Text type="secondary">Credentials are write-only. Empty secret fields retain the stored value.</Typography.Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => openRpc()}>Add RPC</Button></div>
            <Table<WalletRpcNode>
              rowKey="id" dataSource={data.rpcNodes} pagination={false} scroll={{ x: 1100 }}
              columns={[
                { title: 'Node', render: (_, row) => <><Typography.Text strong>{row.nodeLabel}</Typography.Text><br /><Typography.Text type="secondary">{row.rpcUrl}</Typography.Text></> },
                { title: 'Environment', dataIndex: 'environment' },
                { title: 'Purpose', dataIndex: 'purpose' },
                { title: 'Priority', dataIndex: 'priority' },
                { title: 'Auth', render: (_, row) => <>{row.authType}<br /><Typography.Text type="secondary">{row.apiKeyConfigured || row.passwordConfigured ? 'Credentials configured' : 'No credentials'}</Typography.Text></> },
                { title: 'Health', render: (_, row) => row.lastCheckedAt ? <><Tag color={row.lastError ? 'red' : 'green'}>{row.lastError ? 'FAILED' : 'HEALTHY'}</Tag><br /><Typography.Text type="secondary">{row.lastLatencyMs} ms{row.lastHttpStatus ? ` · HTTP ${row.lastHttpStatus}` : ''}</Typography.Text></> : 'Not tested' },
                { title: 'Status', dataIndex: 'enabled', render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'ENABLED' : 'DISABLED'}</Tag> },
                { title: 'Actions', fixed: 'right', render: (_, row) => <Space><Button size="small" icon={<ExperimentOutlined />} onClick={() => testRpc(row)}>Test</Button><Button size="small" icon={<EditOutlined />} onClick={() => openRpc(row)}>Edit</Button><Popconfirm title="Delete this disabled RPC node?" onConfirm={() => deleteRpc(row)}><Button size="small" danger icon={<DeleteOutlined />} disabled={row.enabled}>Delete</Button></Popconfirm></Space> },
              ]}
            />
          </section>
          <section className="data-panel">
            <div className="wallet-panel-heading"><Typography.Title level={2}>Tokens on this network</Typography.Title><Link to={`/platform/wallet-config/tokens?chain=${data.chain.chain}`}>Manage tokens</Link></div>
            <Table rowKey="id" dataSource={data.tokens} pagination={false} columns={[
              { title: 'Token', dataIndex: 'symbol' }, { title: 'Standard', dataIndex: 'standard' },
              { title: 'Contract', dataIndex: 'contractAddress', ellipsis: true },
              { title: 'Effective', dataIndex: 'effectiveEnabled', render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'ACTIVE' : 'INACTIVE'}</Tag> },
            ]} />
          </section>
        </>
      ) : null}
      <Modal title="Edit chain profile" open={editChain} width={900} confirmLoading={saving} onOk={saveChain} onCancel={() => setEditChain(false)} destroyOnHidden>
        <Form form={chainForm} layout="vertical"><WalletChainForm switches={false} /></Form>
      </Modal>
      <Modal title={editingRpc ? 'Edit RPC node' : 'Add RPC node'} open={rpcOpen} width={760} confirmLoading={saving} onOk={saveRpc} onCancel={() => setRpcOpen(false)} destroyOnHidden>
        <Form form={rpcForm} layout="vertical">
          <Space align="start" wrap>
            <Form.Item name="environment" label="Environment" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="nodeLabel" label="Node label" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="purpose" label="Purpose" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="priority" label="Priority" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="connectionType" label="Connection type" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="authType" label="Auth type" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="authHeaderName" label="Auth header"><Input /></Form.Item>
            <Form.Item name="minRequestIntervalMs" label="Min interval (ms)" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          </Space>
          <Form.Item name="rpcUrl" label="RPC URL" rules={[{ required: true }, { type: 'url' }]}><Input /></Form.Item>
          <Space align="start" wrap>
            <Form.Item name="apiKey" label={editingRpc?.apiKeyConfigured ? 'Replace API key' : 'API key'}><Input.Password autoComplete="new-password" /></Form.Item>
            <Form.Item name="username" label={editingRpc?.usernameConfigured ? 'Replace username' : 'Username'}><Input autoComplete="off" /></Form.Item>
            <Form.Item name="password" label={editingRpc?.passwordConfigured ? 'Replace password' : 'Password'}><Input.Password autoComplete="new-password" /></Form.Item>
          </Space>
          <Form.Item name="remark" label="Remark"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
