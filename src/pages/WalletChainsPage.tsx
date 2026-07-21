import { useMemo, useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import {
  ArrowRightOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import {
  defaultChainValues,
  WalletChainForm,
  type WalletChainFormValues,
} from '../components/WalletChainForm';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletChain, WalletChainDetail } from '../types/platform';
import { useI18n } from '../i18n';

type ChainGroup = {
  chain: string;
  family: string;
  nativeSymbol: string;
  profiles: WalletChain[];
  tokenSymbols: string[];
  rpcCount: number;
  enabledProfile?: WalletChain;
  targetProfile: WalletChain;
};

function groupProfiles(profiles: WalletChain[]): ChainGroup[] {
  const grouped = new Map<string, WalletChain[]>();
  profiles.forEach((profile) => {
    const current = grouped.get(profile.chain) ?? [];
    current.push(profile);
    grouped.set(profile.chain, current);
  });

  return [...grouped.entries()].map(([chain, chainProfiles]) => {
    const sorted = chainProfiles.toSorted((left, right) => {
      if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
      if (left.network === 'mainnet') return -1;
      if (right.network === 'mainnet') return 1;
      return left.network.localeCompare(right.network);
    });
    const tokenSymbols = [...new Set(sorted.flatMap((profile) => profile.tokenSymbols))]
      .toSorted((left, right) => left.localeCompare(right));
    return {
      chain,
      family: sorted[0].family,
      nativeSymbol: sorted[0].nativeSymbol,
      profiles: sorted,
      tokenSymbols,
      rpcCount: sorted.reduce((total, profile) => total + profile.rpcCount, 0),
      enabledProfile: sorted.find((profile) => profile.enabled),
      targetProfile: sorted[0],
    };
  }).toSorted((left, right) => left.chain.localeCompare(right.chain));
}

export default function WalletChainsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<WalletChainFormValues>();
  const query = useApiQuery<WalletChain[]>((signal) => session
    ? api.get('/custody/platform/v1/wallet-config/chains', signal)
    : Promise.resolve([]), [session?.userId]);

  const groups = useMemo(() => groupProfiles(query.data ?? []), [query.data]);
  const rows = groups.filter((row) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [
      row.chain,
      row.family,
      row.nativeSymbol,
      ...row.profiles.map((profile) => profile.network),
      ...row.tokenSymbols,
    ].some((value) => value.toLowerCase().includes(needle));
  });

  const create = async () => {
    if (!session) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const result = await api.post<WalletChainDetail>(
        '/custody/platform/v1/wallet-config/chains', values,
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
    <div className="page-stack chain-management-page">
      <PageHeader
        title={t('Chains & Tokens')}
        description={t('Select a chain, switch networks, and manage its configuration, RPC nodes, and tokens in one place.')}
        actions={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              {t('Add chain profile')}
            </Button>
          </Space>
        )}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel chain-directory-panel">
        <div className="chain-search-bar">
          <Input
            size="large"
            prefix={<SearchOutlined />}
            placeholder={t('Search by chain or token')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
          />
          <div className="chain-directory-summary">
            <span>{t('{count} chains', { count: rows.length })}</span>
            <i aria-hidden />
            <span>{t('{count} network profiles', { count: rows.reduce((total, row) => total + row.profiles.length, 0) })}</span>
          </div>
        </div>
        <Table<ChainGroup>
          className="chain-directory-table"
          rowKey="chain"
          loading={query.loading}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description={t('No chains match this search')} /> }}
          scroll={{ x: 1080 }}
          onRow={(row) => ({
            onClick: () => navigate(`/platform/wallet-config/chains/${row.targetProfile.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('Chain'),
              width: 250,
              render: (_, row) => (
                <div className="chain-identity-cell">
                  <ChainLogo chain={row.chain} size={42} />
                  <div>
                    <Typography.Text strong>{row.chain}</Typography.Text>
                    <Typography.Text type="secondary">
                      {row.nativeSymbol} · {row.family}
                    </Typography.Text>
                  </div>
                </div>
              ),
            },
            {
              title: t('Networks'),
              width: 280,
              render: (_, row) => (
                <div className="chain-network-list">
                  {row.profiles.map((profile) => (
                    <Tag key={profile.id} color={profile.enabled ? 'green' : 'default'}>
                      {profile.enabled ? <i aria-hidden /> : null}
                      {profile.network}
                    </Tag>
                  ))}
                </div>
              ),
            },
            {
              title: t('Supported tokens'),
              render: (_, row) => row.tokenSymbols.length ? (
                <div className="chain-token-list">
                  {row.tokenSymbols.map((symbol) => (
                    <span className="chain-token-chip" key={symbol}>
                      <AssetLogo symbol={symbol} size={22} />
                      {symbol}
                    </span>
                  ))}
                </div>
              ) : <Typography.Text type="secondary">{t('Native asset only')}</Typography.Text>,
            },
            {
              title: t('Active network'),
              width: 150,
              render: (_, row) => row.enabledProfile ? (
                <Tag color="green">{row.enabledProfile.network}</Tag>
              ) : <Tag>{t('None')}</Tag>,
            },
            {
              title: t('RPC nodes'),
              dataIndex: 'rpcCount',
              width: 105,
              align: 'center',
            },
            {
              title: '',
              width: 54,
              fixed: 'right',
              render: () => <Button type="text" icon={<ArrowRightOutlined />} aria-label={t('Open chain')} />,
            },
          ]}
        />
      </section>
      <Modal
        title={t('Add chain profile')}
        open={open}
        width={1040}
        confirmLoading={saving}
        onOk={create}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={defaultChainValues}>
          <WalletChainForm />
        </Form>
      </Modal>
    </div>
  );
}
