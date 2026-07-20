import { useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
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
  metadata?: Record<string, unknown>;
};

type GasAccount = {
  chain: string;
  nativeSymbol: string;
  availableBalance: string | number;
  lowBalance: boolean;
  status: string;
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
  const [pendingWithdrawal, setPendingWithdrawal] = useState<WithdrawalValues>();
  const [form] = Form.useForm<WithdrawalValues>();
  const selectedChain = Form.useWatch('chain', form);

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
  const gasQuery = useApiQuery<GasAccount[]>(
    (signal) => session && type === 'withdrawals'
      ? api.get('/custody/console/v1/gas-accounts', session.token, signal)
      : Promise.resolve([]),
    [session?.token, type],
  );

  const addressOptions = useMemo(
    () => (addressQuery.data ?? [])
      .filter((row) => row.metadata?.systemPurpose !== 'GAS_FUNDING')
      .map((row) => ({
      value: row.id,
      label: `${row.label || row.externalReference || row.chain} — ${row.address.slice(0, 10)}…`,
      row,
    })),
    [addressQuery.data],
  );
  const selectedGas = (gasQuery.data ?? []).find(
    (account) => account.chain === selectedChain && account.status === 'ACTIVE',
  );
  const gasReady = Boolean(
    selectedGas && Number(selectedGas.availableBalance) > 0,
  );

  const createWithdrawal = async (values: WithdrawalValues) => {
    if (!session) return;
    setCreating(true);
    try {
      await api.post('/custody/console/v1/withdrawals', session.token, {
        ...values,
        amount: String(values.amount),
        confirmed: true,
      });
      await message.success('Withdrawal created; asset and network-fee reserves are frozen');
      form.resetFields();
      setPendingWithdrawal(undefined);
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
          onFinish={setPendingWithdrawal}
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
            checked and frozen atomically with the tenant network-fee reserve.
          </div>
          {selectedChain ? (
            selectedGas ? (
              <Alert
                showIcon
                type={selectedGas.lowBalance ? 'warning' : 'success'}
                title={`${selectedGas.chain} gas balance: ${formatAmount(selectedGas.availableBalance)} ${selectedGas.nativeSymbol}`}
                description={selectedGas.lowBalance
                  ? 'The reserve is below its warning threshold. Funding it before a busy payout window is recommended.'
                  : 'A conservative network-fee amount will be locked when you confirm.'}
              />
            ) : (
              <Alert
                showIcon
                type="error"
                title={`No funded ${selectedChain} gas reserve`}
                description="Create and fund this network in Gas station before requesting a withdrawal."
              />
            )
          ) : null}
          <Button type="primary" htmlType="submit" block disabled={Boolean(selectedChain) && !gasReady}>
            Review withdrawal
          </Button>
        </Form>
      </Drawer>

      <Modal
        title="Confirm withdrawal"
        open={Boolean(pendingWithdrawal)}
        zIndex={1300}
        confirmLoading={creating}
        okText="Confirm and freeze funds"
        cancelText="Go back"
        onOk={() => pendingWithdrawal && void createWithdrawal(pendingWithdrawal)}
        onCancel={() => setPendingWithdrawal(undefined)}
      >
        {pendingWithdrawal ? (
          <div className="withdrawal-confirmation">
            <Alert
              showIcon
              type="warning"
              title="Check every value carefully"
              description="After broadcast, a blockchain withdrawal cannot be reversed. The source asset and a conservative tenant gas reserve are frozen atomically when you confirm."
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Network">
                {pendingWithdrawal.chain}
              </Descriptions.Item>
              <Descriptions.Item label="Asset">
                {pendingWithdrawal.assetSymbol}
              </Descriptions.Item>
              <Descriptions.Item label="Amount">
                {pendingWithdrawal.amount} {pendingWithdrawal.assetSymbol}
              </Descriptions.Item>
              <Descriptions.Item label="Destination">
                <CopyText value={pendingWithdrawal.toAddress} />
              </Descriptions.Item>
              <Descriptions.Item label="External reference">
                {pendingWithdrawal.externalReference || '—'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
