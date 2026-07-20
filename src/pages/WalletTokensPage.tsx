import { useMemo, useState } from 'react';
import {
  App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select,
  Space, Switch, Table, Tag, Typography,
} from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletChain, WalletToken } from '../types/platform';
import { useI18n } from '../i18n';

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

export default function WalletTokensPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState(params.get('chain') ?? '');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WalletToken>();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<TokenFormValues>();
  const selectedChain = Form.useWatch('chain', form);
  const selectedNetwork = Form.useWatch('network', form);
  const tokenQuery = useApiQuery<WalletToken[]>((signal) => session
    ? api.get('/custody/platform/v1/wallet-config/tokens/matrix', session.token, signal)
    : Promise.resolve([]), [session?.token]);
  const chainQuery = useApiQuery<WalletChain[]>((signal) => session
    ? api.get('/custody/platform/v1/wallet-config/chains', session.token, signal)
    : Promise.resolve([]), [session?.token]);

  const chains = useMemo(() => chainQuery.data ?? [], [chainQuery.data]);
  const rows = (tokenQuery.data ?? []).filter((row) => {
    const needle = search.trim().toLowerCase();
    return (!needle || row.symbol.toLowerCase().includes(needle)
      || row.contractAddress.toLowerCase().includes(needle))
      && (!chainFilter || row.chain === chainFilter);
  });

  const openEditor = (token?: WalletToken) => {
    setEditing(token);
    form.resetFields();
    form.setFieldsValue(token ? {
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
      decimals: 18,
      enabled: false,
      collectEnabled: false,
    } as TokenFormValues);
    setOpen(true);
  };

  const save = async () => {
    if (!session) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api.patch(`/custody/platform/v1/wallet-config/tokens/${editing.id}`, session.token, values);
      else await api.post('/custody/platform/v1/wallet-config/tokens', session.token, values);
      await message.success(t(editing ? 'Token updated' : 'Token created'));
      setOpen(false);
      form.resetFields();
      tokenQuery.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save token'));
    } finally { setSaving(false); }
  };

  const toggle = async (token: WalletToken) => {
    if (!session) return;
    try {
      await api.patch(`/custody/platform/v1/wallet-config/tokens/${token.id}/status`, session.token, { enabled: !token.enabled });
      await message.success(t(token.enabled ? 'Token disabled' : 'Token enabled'));
      tokenQuery.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update token status'));
    }
  };

  const profileOptions = chains.map((profile) => ({
    label: `${profile.chain} · ${profile.network}${profile.enabled ? '' : ` (${t('disabled')})`}`,
    value: `${profile.chain}|${profile.network}`,
    chain: profile.chain,
    network: profile.network,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Token management')}
        description={t('One Token operation atomically updates its runtime token and ledger asset definitions.')}
        actions={<Space><Button icon={<ReloadOutlined />} onClick={tokenQuery.refetch}>{t('Reload')}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>{t('Add token')}</Button></Space>}
      />
      <ErrorState message={tokenQuery.error || chainQuery.error} onRetry={() => { tokenQuery.refetch(); chainQuery.refetch(); }} />
      <section className="data-panel">
        <Space wrap className="table-toolbar">
          <Input prefix={<SearchOutlined />} placeholder={t('Search symbol or contract')} value={search} onChange={(event) => setSearch(event.target.value)} allowClear />
          <Select allowClear placeholder={t('All chains')} value={chainFilter || undefined} onChange={(value) => setChainFilter(value ?? '')} style={{ minWidth: 180 }} options={[...new Set(chains.map((row) => row.chain))].map((chain) => ({ label: chain, value: chain }))} />
        </Space>
        <Table<WalletToken>
          rowKey="id" loading={tokenQuery.loading} dataSource={rows} pagination={{ pageSize: 25 }} scroll={{ x: 1200 }}
          columns={[
            { title: t('Token'), render: (_, row) => <><Typography.Text strong>{row.symbol}</Typography.Text><br /><Typography.Text type="secondary">{row.standard} · {t('{count} decimals', { count: row.decimals })}</Typography.Text></> },
            { title: t('Chain / network'), render: (_, row) => `${row.chain} · ${row.network}` },
            { title: t('Configured'), dataIndex: 'enabled', render: (value) => <Tag color={value ? 'blue' : 'default'}>{t(value ? 'Enabled' : 'Disabled')}</Tag> },
            { title: t('Chain'), dataIndex: 'chainEnabled', render: (value) => <Tag color={value ? 'green' : 'gold'}>{t(value ? 'On' : 'Off')}</Tag> },
            { title: t('Actual state'), dataIndex: 'effectiveEnabled', render: (value, row) => <><Tag color={value ? 'green' : 'default'}>{t(value ? 'Active' : 'Inactive')}</Tag>{!value && row.blockers.length ? <Typography.Text type="secondary">{row.blockers.map((item) => t(item)).join(' ')}</Typography.Text> : null}</> },
            { title: t('Contract'), dataIndex: 'contractAddress', ellipsis: true },
            { title: t('Actions'), fixed: 'right', render: (_, row) => <Space><Button size="small" icon={<EditOutlined />} onClick={() => openEditor(row)}>{t('Edit')}</Button><Popconfirm title={t('{action} {symbol}?', { action: t(row.enabled ? 'Disable' : 'Enable'), symbol: row.symbol })} onConfirm={() => toggle(row)}><Button size="small">{t(row.enabled ? 'Disable' : 'Enable')}</Button></Popconfirm></Space> },
          ]}
        />
      </section>
      <Modal title={editing ? t('Edit {symbol}', { symbol: editing.symbol }) : t('Add token')} open={open} width={800} confirmLoading={saving} onOk={save} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item label={t('Chain profile')} required>
            <Select
              value={selectedChain && selectedNetwork ? `${selectedChain}|${selectedNetwork}` : undefined}
              options={profileOptions}
              onChange={(value) => {
                const [chain, network] = value.split('|');
                form.setFieldsValue({ chain, network });
              }}
            />
          </Form.Item>
          <Form.Item name="chain" hidden rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="network" hidden rules={[{ required: true }]}><Input /></Form.Item>
          <Space align="start" wrap>
            <Form.Item name="symbol" label={t('Symbol')} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="standard" label={t('Token standard')} rules={[{ required: true }]}><Input placeholder="ERC20" /></Form.Item>
            <Form.Item name="decimals" label={t('Decimals')} rules={[{ required: true }]}><InputNumber min={0} max={38} /></Form.Item>
            <Form.Item name="confirmationRequired" label={t('Confirmations')}><InputNumber min={0} /></Form.Item>
          </Space>
          <Form.Item name="contractAddress" label={t('Contract address')} rules={[{ required: true }]}><Input /></Form.Item>
          <Space align="start" wrap>
            <Form.Item name="contractAddressBase58" label={t('Base58 contract')}><Input /></Form.Item>
            <Form.Item name="contractAddressHex" label={t('Hex contract')}><Input /></Form.Item>
            <Form.Item name="gasStrategy" label={t('Gas strategy')}><Input /></Form.Item>
          </Space>
          <Space align="start" wrap>
            <Form.Item name="minDeposit" label={t('Minimum deposit')}><Input /></Form.Item>
            <Form.Item name="minWithdraw" label={t('Minimum withdrawal')}><Input /></Form.Item>
            <Form.Item name="collectThreshold" label={t('Collection threshold')}><Input /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="enabled" label={t('Enabled')} valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="collectEnabled" label={t('Collection enabled')} valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
