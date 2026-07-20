import { useState } from 'react';
import { App, Button, Form, Input, Modal, Space, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { defaultChainValues, WalletChainForm, type WalletChainFormValues } from '../components/WalletChainForm';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletChain, WalletChainDetail } from '../types/platform';
import { useI18n } from '../i18n';

export default function WalletChainsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<WalletChainFormValues>();
  const query = useApiQuery<WalletChain[]>((signal) => session
    ? api.get('/custody/platform/v1/wallet-config/chains', session.token, signal)
    : Promise.resolve([]), [session?.token]);

  const rows = (query.data ?? []).filter((row) => {
    const needle = search.trim().toLowerCase();
    return (!needle || [row.chain, row.network, row.family, row.nativeSymbol, ...row.tokenSymbols]
      .some((value) => value.toLowerCase().includes(needle))) && (!enabledOnly || row.enabled);
  });

  const create = async () => {
    if (!session) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const result = await api.post<WalletChainDetail>(
        '/custody/platform/v1/wallet-config/chains', session.token, values,
      );
      await message.success(t('Chain profile created'));
      setOpen(false);
      form.resetFields();
      navigate(`/platform/wallet-config/chains/${result.chain.id}`);
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to create chain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Chains & RPC')}
        description={t('Manage network profiles and open a chain to configure its RPC nodes.')}
        actions={<Space><Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('Add chain')}</Button></Space>}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <Space wrap className="table-toolbar">
          <Input prefix={<SearchOutlined />} placeholder={t('Search chain, network or family')} value={search} onChange={(event) => setSearch(event.target.value)} allowClear />
          <Space><Switch checked={enabledOnly} onChange={setEnabledOnly} /> {t('Enabled only')}</Space>
        </Space>
        <Table<WalletChain>
          rowKey="id"
          loading={query.loading}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          onRow={(row) => ({ onClick: () => navigate(`/platform/wallet-config/chains/${row.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: t('Chain'), render: (_, row) => <><Typography.Text strong>{row.chain}</Typography.Text><br /><Typography.Text type="secondary">{row.nativeSymbol}</Typography.Text></> },
            { title: t('Network'), dataIndex: 'network' },
            { title: t('Family'), dataIndex: 'family' },
            { title: t('Status'), dataIndex: 'enabled', render: (value) => <Tag color={value ? 'green' : 'default'}>{t(value ? 'Enabled' : 'Disabled')}</Tag> },
            { title: t('Task switches'), render: (_, row) => [row.scanEnabled && t('Scan'), row.withdrawEnabled && t('Withdraw'), row.collectionEnabled && t('Collect'), row.transferEnabled && t('Transfer')].filter(Boolean).join(' · ') || '—' },
            { title: t('Tokens'), dataIndex: 'tokenCount' },
            { title: t('RPC nodes'), dataIndex: 'rpcCount' },
          ]}
        />
      </section>
      <Modal title={t('Add chain profile')} open={open} width={900} confirmLoading={saving} onOk={create} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={defaultChainValues}><WalletChainForm /></Form>
      </Modal>
    </div>
  );
}
