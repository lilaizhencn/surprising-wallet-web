import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatAmount, formatDate, queryString } from '../utils/format';

type TransferType = 'deposits' | 'withdrawals';

type DepositRow = {
  id: string;
  custodyAddressId: string;
  externalReference?: string;
  chain: string;
  assetSymbol: string;
  txHash: string;
  logIndex: number;
  amount: string | number;
  status: string;
  creditedAt?: string;
  createdAt: string;
};

type WithdrawalRow = {
  id: string;
  custodyAddressId: string;
  orderNo: string;
  externalReference?: string;
  chain: string;
  assetSymbol: string;
  toAddress: string;
  amount: string | number;
  fee: string | number;
  txHash?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
};

type AddressOption = {
  id: string;
  chain: string;
  address: string;
  label?: string;
  externalReference?: string;
};

type WithdrawalValues = {
  custodyAddressId: string;
  chain: string;
  assetSymbol: string;
  toAddress: string;
  amount: string;
  externalReference?: string;
};

export default function TransfersPage({ type }: { type: TransferType }) {
  const session = useSession();
  const { message } = App.useApp();
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<WithdrawalValues>();

  const query = useApiQuery<Array<DepositRow | WithdrawalRow>>(
    (signal) => session
      ? api.get(
          `/custody/console/v1/${type}${queryString({ status, limit: 100 })}`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, type, status],
  );

  const addressQuery = useApiQuery<AddressOption[]>(
    (signal) => session && type === 'withdrawals'
      ? api.get('/custody/console/v1/addresses?status=ACTIVE&limit=200', session.token, signal)
      : Promise.resolve([]),
    [session?.token, type],
  );

  const addressOptions = useMemo(
    () => (addressQuery.data ?? []).map((row) => ({
      value: row.id,
      label: `${row.label || row.externalReference || row.chain} — ${row.address.slice(0, 10)}…`,
      row,
    })),
    [addressQuery.data],
  );

  const createWithdrawal = async (values: WithdrawalValues) => {
    if (!session) return;
    setCreating(true);
    try {
      await api.post('/custody/console/v1/withdrawals', session.token, {
        ...values,
        amount: String(values.amount),
      });
      await message.success('Withdrawal created and balance frozen');
      form.resetFields();
      setDrawerOpen(false);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to create withdrawal');
    } finally {
      setCreating(false);
    }
  };

  const depositColumns = [
    {
      title: 'Transaction',
      dataIndex: 'txHash',
      render: (value: string) => <CopyText value={value} />,
    },
    { title: 'Network', dataIndex: 'chain' },
    { title: 'Asset', dataIndex: 'assetSymbol' },
    {
      title: 'Amount',
      render: (_: unknown, row: DepositRow) =>
        `${formatAmount(row.amount)} ${row.assetSymbol}`,
    },
    {
      title: 'External reference',
      dataIndex: 'externalReference',
      render: (value?: string) => value || '—',
    },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusText value={value} /> },
    { title: 'Credited', dataIndex: 'creditedAt', render: formatDate },
  ];

  const withdrawalColumns = [
    {
      title: 'Order',
      dataIndex: 'orderNo',
      render: (value: string) => <CopyText value={value} />,
    },
    { title: 'Network', dataIndex: 'chain' },
    { title: 'Asset', dataIndex: 'assetSymbol' },
    {
      title: 'Amount',
      render: (_: unknown, row: WithdrawalRow) =>
        `${formatAmount(row.amount)} ${row.assetSymbol}`,
    },
    {
      title: 'Fee reserve',
      render: (_: unknown, row: WithdrawalRow) =>
        `${formatAmount(row.fee)} ${row.assetSymbol}`,
    },
    {
      title: 'External reference',
      dataIndex: 'externalReference',
      render: (value?: string) => value || '—',
    },
    { title: 'Destination', dataIndex: 'toAddress', render: (value: string) => <CopyText value={value} /> },
    { title: 'Transaction', dataIndex: 'txHash', render: (value?: string) => <CopyText value={value} /> },
    { title: 'Status', dataIndex: 'status', render: (value: string) => <StatusText value={value} /> },
    { title: 'Created', dataIndex: 'createdAt', render: formatDate },
  ];

  const title = type === 'deposits' ? 'Deposits' : 'Withdrawals';
  return (
    <div className="page-stack">
      <PageHeader
        title={title}
        description={
          type === 'deposits'
            ? 'Confirmed on-chain deposits attributed to this tenant.'
            : 'Tenant withdrawals and their signing, broadcast, and confirmation state.'
        }
        actions={type === 'withdrawals' ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Create withdrawal
          </Button>
        ) : undefined}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <div className="table-toolbar">
          <Select
            allowClear
            placeholder="Status"
            style={{ minWidth: 190 }}
            options={[
              'CONFIRMED', 'CREATED', 'PENDING_REVIEW', 'FROZEN', 'SIGNING',
              'SENT', 'BROADCAST_UNKNOWN', 'FAILED', 'REJECTED',
            ].map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
            onChange={(value = '') => setStatus(value)}
          />
          <Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button>
        </div>
        {type === 'deposits' ? (
          <Table<DepositRow>
            rowKey="id"
            loading={query.loading}
            dataSource={(query.data ?? []) as DepositRow[]}
            columns={depositColumns}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No deposits yet" /> }}
            scroll={{ x: 900 }}
          />
        ) : (
          <Table<WithdrawalRow>
            rowKey="id"
            loading={query.loading}
            dataSource={(query.data ?? []) as WithdrawalRow[]}
            columns={withdrawalColumns}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No withdrawals yet" /> }}
            scroll={{ x: 1300 }}
          />
        )}
      </section>

      <Drawer
        title="Create withdrawal"
        size={460}
        open={drawerOpen}
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
      >
        <Form<WithdrawalValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={createWithdrawal}
        >
          <Form.Item
            name="custodyAddressId"
            label="Source custody address"
            rules={[{ required: true, message: 'Select the tenant address account to debit' }]}
          >
            <Select
              showSearch
              loading={addressQuery.loading}
              options={addressOptions}
              optionFilterProp="label"
              onChange={(value) => {
                const selected = addressOptions.find((item) => item.value === value)?.row;
                if (selected) form.setFieldValue('chain', selected.chain);
              }}
            />
          </Form.Item>
          <Form.Item name="chain" label="Network" rules={[{ required: true }]}>
            <Input readOnly />
          </Form.Item>
          <Form.Item
            name="assetSymbol"
            label="Asset"
            rules={[{ required: true, message: 'Enter the enabled asset symbol' }]}
          >
            <Input placeholder="USDT" />
          </Form.Item>
          <Form.Item
            name="toAddress"
            label="Destination address"
            rules={[{ required: true, message: 'Enter a destination address' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Enter a positive amount' }]}
          >
            <InputNumber<string>
              stringMode
              min="0.000000000000000001"
              controls={false}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="externalReference" label="External reference (optional)">
            <Input maxLength={160} placeholder="payout-2026-00421" />
          </Form.Item>
          <div className="form-warning">
            The selected address account is the funding boundary. Available balance is
            checked and frozen atomically before the order is accepted.
          </div>
          <Button type="primary" htmlType="submit" block loading={creating}>
            Create and freeze withdrawal
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
