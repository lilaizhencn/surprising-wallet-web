import { useState } from 'react';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  InputNumber,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { commonChainOptions } from '../constants/chains';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import { formatAmount, formatDate } from '../utils/format';

type GasAccount = {
  id: string;
  custodyAddressId: string;
  chain: string;
  network: string;
  nativeSymbol: string;
  address: string;
  memo?: string;
  availableBalance: string | number;
  lockedBalance: string | number;
  totalBalance: string | number;
  lowBalanceThreshold: string | number;
  lowBalance: boolean;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
};

type GasTopup = {
  id: string;
  chain: string;
  assetSymbol: string;
  txHash: string;
  amount: string | number;
  status: string;
  creditedAt?: string;
  createdAt: string;
};

type GasUsage = {
  id: string;
  custodyWithdrawalId: string;
  orderNo: string;
  chain: string;
  nativeSymbol: string;
  reservedAmount: string | number;
  actualAmount?: string | number;
  status: 'RESERVED' | 'SETTLED' | 'RELEASED' | 'OVERDUE';
  pricingSource: string;
  txHash?: string;
  errorMessage?: string;
  createdAt: string;
  settledAt?: string;
};

type CreateGasValues = {
  chain: string;
  lowBalanceThreshold: string;
};

type UpdateGasValues = {
  lowBalanceThreshold: string;
};

export default function GasStationPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [createForm] = Form.useForm<CreateGasValues>();
  const [updateForm] = Form.useForm<UpdateGasValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<GasAccount>();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const accounts = useApiQuery<GasAccount[]>(
    (signal) => session
      ? api.get('/custody/console/v1/gas-accounts', session.token, signal)
      : Promise.resolve([]),
    [session?.token],
  );
  const topups = useApiQuery<GasTopup[]>(
    (signal) => session && selected
      ? api.get(
          `/custody/console/v1/gas-accounts/${selected.id}/topups?limit=100`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, selected?.id],
  );
  const usage = useApiQuery<GasUsage[]>(
    (signal) => session && selected
      ? api.get(
          `/custody/console/v1/gas-accounts/${selected.id}/usage?limit=100`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, selected?.id],
  );

  const createAccount = async (values: CreateGasValues) => {
    if (!session) return;
    setCreating(true);
    try {
      const created = await api.post<GasAccount>(
        '/custody/console/v1/gas-accounts',
        session.token,
        {
          chain: values.chain,
          lowBalanceThreshold: String(values.lowBalanceThreshold),
        },
      );
      await message.success(t('{chain} gas reserve created', { chain: created.chain }));
      createForm.resetFields();
      setCreateOpen(false);
      setSelected(created);
      updateForm.setFieldsValue({
        lowBalanceThreshold: String(created.lowBalanceThreshold),
      });
      accounts.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to create gas reserve'));
    } finally {
      setCreating(false);
    }
  };

  const updateAccount = async (
    values: UpdateGasValues,
    status = selected?.status,
  ) => {
    if (!session || !selected || !status) return;
    setSaving(true);
    try {
      const updated = await api.patch<GasAccount>(
        `/custody/console/v1/gas-accounts/${selected.id}`,
        session.token,
        {
          lowBalanceThreshold: String(values.lowBalanceThreshold),
          status,
        },
      );
      setSelected(updated);
      updateForm.setFieldsValue({
        lowBalanceThreshold: String(updated.lowBalanceThreshold),
      });
      await message.success(t('Gas reserve settings saved'));
      accounts.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to update gas reserve'));
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (account: GasAccount) => {
    setSelected(account);
    updateForm.setFieldsValue({
      lowBalanceThreshold: String(account.lowBalanceThreshold),
    });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Gas station')}
        description={t('Pre-fund native coins, reserve fees atomically for withdrawals, and audit every network-fee settlement.')}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            {t('Add gas reserve')}
          </Button>
        }
      />
      <Alert
        showIcon
        type="info"
        title={t('Gas reserves use real on-chain balances')}
        description={t('Create one reserve per network, send only its native coin to the displayed address, and wait for confirmations. A withdrawal locks a conservative fee reserve, releases it on failure, and settles it after confirmation.')}
      />
      <ErrorState message={accounts.error} onRetry={accounts.refetch} />
      <section className="data-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('Network reserves')}</h2>
            <p>{t('Low-balance warnings compare available funds with your configured threshold.')}</p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={accounts.refetch}>{t('Reload')}</Button>
        </div>
        <Table<GasAccount>
          rowKey="id"
          loading={accounts.loading}
          dataSource={accounts.data ?? []}
          pagination={false}
          locale={{
            emptyText: (
              <Empty description={t('No gas reserve configured')}>
                <Button type="primary" onClick={() => setCreateOpen(true)}>
                  {t('Create first reserve')}
                </Button>
              </Empty>
            ),
          }}
          scroll={{ x: 1080 }}
          columns={[
            {
              title: t('Network'),
              render: (_, row) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{row.chain}</Typography.Text>
                  <Typography.Text type="secondary">{row.network}</Typography.Text>
                </Space>
              ),
            },
            { title: t('Gas asset'), dataIndex: 'nativeSymbol' },
            {
              title: t('Funding address'),
              dataIndex: 'address',
              render: (value: string) => <CopyText value={value} />,
            },
            {
              title: t('Available'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.availableBalance)} ${row.nativeSymbol}`,
            },
            {
              title: t('Total'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.totalBalance)} ${row.nativeSymbol}`,
            },
            {
              title: t('Warning below'),
              align: 'right',
              render: (_, row) => `${formatAmount(row.lowBalanceThreshold)} ${row.nativeSymbol}`,
            },
            {
              title: t('Health'),
              render: (_, row) => (
                <StatusText
                  value={row.status === 'DISABLED'
                    ? 'DISABLED'
                    : row.lowBalance ? 'LOW_BALANCE' : 'READY'}
                />
              ),
            },
            {
              title: '',
              fixed: 'right',
              render: (_, row) => (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openDetails(row)}
                >
                  {t('Manage')}
                </Button>
              ),
            },
          ]}
        />
      </section>

      <Drawer
        title={t('Create gas reserve')}
        size={440}
        open={createOpen}
        destroyOnHidden
        onClose={() => setCreateOpen(false)}
        extra={<Button onClick={() => setCreateOpen(false)}>{t('Cancel')}</Button>}
      >
        <Alert
          showIcon
          type="warning"
          title={t('Choose the exact network')}
          description={t('The generated address accepts the network native coin used for transaction fees. Sending an unsupported asset or using another network can lose funds.')}
        />
        <Form<CreateGasValues>
          form={createForm}
          layout="vertical"
          requiredMark={false}
          onFinish={createAccount}
          initialValues={{ lowBalanceThreshold: '0.05' }}
        >
          <Form.Item
            name="chain"
            label={t('Network')}
            rules={[{ required: true, message: t('Select or enter a network') }]}
          >
            <AutoComplete options={commonChainOptions} placeholder="ETH" filterOption />
          </Form.Item>
          <Form.Item
            name="lowBalanceThreshold"
            label={t('Low-balance warning threshold')}
            rules={[{ required: true, message: t('Enter a positive threshold') }]}
            extra={t('This is an alert threshold, not a synthetic balance or spending limit.')}
          >
            <InputNumber<string>
              stringMode
              min="0.000000000000000000000001"
              controls={false}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={creating}
            icon={<ThunderboltOutlined />}
          >
            {t('Create funding address')}
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title={selected ? t('{chain} gas reserve', { chain: selected.chain }) : t('Gas reserve')}
        size={620}
        open={Boolean(selected)}
        destroyOnHidden
        onClose={() => setSelected(undefined)}
      >
        {selected ? (
          <div className="gas-account-details">
            {selected.lowBalance && selected.status === 'ACTIVE' ? (
              <Alert
                showIcon
                type="warning"
                title={t('Gas reserve is below its warning threshold')}
                description={t('Send {symbol} on {chain} to the funding address below.', { symbol: selected.nativeSymbol, chain: selected.chain })}
              />
            ) : null}
            <div className="gas-stat-grid">
              <Statistic
                title={t('Available')}
                value={formatAmount(selected.availableBalance)}
                suffix={selected.nativeSymbol}
              />
              <Statistic
                title={t('Locked')}
                value={formatAmount(selected.lockedBalance)}
                suffix={selected.nativeSymbol}
              />
              <Statistic
                title={t('Total')}
                value={formatAmount(selected.totalBalance)}
                suffix={selected.nativeSymbol}
              />
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('Network')}>
                {selected.chain} · {selected.network}
              </Descriptions.Item>
              <Descriptions.Item label={t('Funding address')}>
                <CopyText value={selected.address} />
              </Descriptions.Item>
              {selected.memo ? (
                <Descriptions.Item label={t('Memo')}>{selected.memo}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('Status')}>
                <StatusText value={selected.status} />
              </Descriptions.Item>
              <Descriptions.Item label={t('Last updated')}>
                {formatDate(selected.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Form<UpdateGasValues>
              form={updateForm}
              layout="vertical"
              requiredMark={false}
              onFinish={(values) => void updateAccount(values)}
            >
              <Form.Item
                name="lowBalanceThreshold"
                label={t('Low-balance warning threshold ({symbol})', { symbol: selected.nativeSymbol })}
                rules={[{ required: true }]}
              >
                <InputNumber<string>
                  stringMode
                  min="0.000000000000000000000001"
                  controls={false}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={saving}>
                  {t('Save threshold')}
                </Button>
                <Popconfirm
                  title={selected.status === 'ACTIVE'
                    ? t('Disable this gas reserve?')
                    : t('Enable this gas reserve?')}
                  description={t('The address remains monitored and existing funds stay visible.')}
                  onConfirm={() => void updateAccount(
                    updateForm.getFieldsValue(),
                    selected.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                  )}
                >
                  <Button danger={selected.status === 'ACTIVE'}>
                    {selected.status === 'ACTIVE' ? t('Disable reserve') : t('Enable reserve')}
                  </Button>
                </Popconfirm>
              </Space>
            </Form>

            <section className="embedded-table">
              <div className="panel-heading">
              <div>
                  <h3>{t('Funding history')}</h3>
                  <p>{t('Only confirmed native-coin deposits increase this reserve.')}</p>
                </div>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    topups.refetch();
                    usage.refetch();
                  }}
                >
                  {t('Reload')}
                </Button>
              </div>
              <ErrorState message={topups.error} onRetry={topups.refetch} />
              <Table<GasTopup>
                rowKey="id"
                size="small"
                loading={topups.loading}
                dataSource={topups.data ?? []}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description={t('No confirmed funding deposits yet')} /> }}
                columns={[
                  { title: t('Transaction'), dataIndex: 'txHash', render: (value) => <CopyText value={value} /> },
                  {
                    title: t('Amount'),
                    render: (_, row) => `${formatAmount(row.amount)} ${row.assetSymbol}`,
                  },
                  { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                  { title: t('Credited'), dataIndex: 'creditedAt', render: formatDate },
                ]}
              />
            </section>
            <section className="embedded-table">
              <div className="panel-heading">
                <div>
                  <h3>{t('Network fee usage')}</h3>
                  <p>
                    {t('Reserved fees are locked when a withdrawal is accepted. Confirmed chain fees settle the charge; failed orders release it.')}
                  </p>
                </div>
              </div>
              <ErrorState message={usage.error} onRetry={usage.refetch} />
              <Table<GasUsage>
                rowKey="id"
                size="small"
                loading={usage.loading}
                dataSource={usage.data ?? []}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description={t('No network fee usage yet')} /> }}
                scroll={{ x: 760 }}
                columns={[
                  { title: t('Withdrawal'), dataIndex: 'orderNo', render: (value) => <CopyText value={value} /> },
                  {
                    title: t('Reserved'),
                    render: (_, row) => `${formatAmount(row.reservedAmount)} ${row.nativeSymbol}`,
                  },
                  {
                    title: t('Settled'),
                    render: (_, row) => row.actualAmount == null
                      ? '—'
                      : `${formatAmount(row.actualAmount)} ${row.nativeSymbol}`,
                  },
                  { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                  {
                    title: t('Pricing'),
                    dataIndex: 'pricingSource',
                    render: (value: string) => value.replaceAll('_', ' '),
                  },
                  { title: t('Transaction'), dataIndex: 'txHash', render: (value?: string) => <CopyText value={value} /> },
                  { title: t('Settled at'), dataIndex: 'settledAt', render: formatDate },
                ]}
              />
              {(usage.data ?? []).some((item) => item.status === 'OVERDUE') ? (
                <Alert
                  showIcon
                  type="error"
                  title={t('Gas balance requires attention')}
                  description={t('An actual network fee exceeded the funded balance. Add native coin; the overdue charge will settle automatically after confirmation, then new withdrawals resume.')}
                />
              ) : null}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
