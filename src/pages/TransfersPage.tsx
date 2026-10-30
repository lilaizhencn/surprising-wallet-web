import { useEffect, useMemo, useRef, useState } from 'react';
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
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { api, apiRequest } from '../api/client';
import { acceptWithdrawalIntent, clearWithdrawalIntent, prepareWithdrawalIntent, readWithdrawalIntent, resolveWithdrawalIntent, withWithdrawalLock, withdrawalOwner, type WithdrawalIntent, type WithdrawalValues } from '../utils/withdrawalIntent';
import { hasScope, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { commonChainOptions } from '../constants/chains';
import { useApiQuery } from '../hooks/useApiQuery';
import { useServerPagination } from '../hooks/useServerPagination';
import { useI18n } from '../i18n';
import { emptyPage, type PageResponse } from '../types/pagination';
import { formatAmount, formatDate, queryString } from '../utils/format';

type TransferType = 'deposits' | 'withdrawals';

type DepositRow = {
  id: string;
  custodyAddressId: string;
  address: string;
  subject: string;
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
  sourceAddress: string;
  subject: string;
  orderNo: string;
  externalReference?: string;
  chain: string;
  assetSymbol: string;
  toAddress: string;
  amount: string | number;
  networkFee?: string | null;
  networkFeeAsset?: string | null;
  networkFeeSource?: string | null;
  gasStatus?: string | null;
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
  subject: string;
  metadata?: Record<string, unknown>;
};

type GasAccount = {
  chain: string;
  nativeSymbol: string;
  availableBalance: string | number;
  lowBalance: boolean;
  status: string;
};



type TransferFilters = {
  chain: string;
  assetSymbol: string;
  status: string;
  search: string;
};

const EMPTY_FILTERS: TransferFilters = {
  chain: '',
  assetSymbol: '',
  status: '',
  search: '',
};

export default function TransfersPage({type}:{type:TransferType}) {
  const session=useSession();
  return <TransferForm key={session ? withdrawalOwner(session) : 'signed-out'} type={type}/>;
}
function TransferForm({ type }: { type: TransferType }) {
  const session = useSession();
  const canCreateWithdrawal = hasScope(session, 'withdrawals:write');
  const { message, modal } = App.useApp();
  const { t } = useI18n();
  const [filters, setFilters] = useState<TransferFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<TransferFilters>(EMPTY_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<WithdrawalValues>();
  const [form] = Form.useForm<WithdrawalValues>();
  const selectedChain = Form.useWatch('chain', form);
  const pagination = useServerPagination(20);
  const owner=session ? withdrawalOwner(session) : '';
  const readRecovery=()=>{ try{return {intent:owner ? readWithdrawalIntent(owner):null,error:''};}catch(error){return {intent:null,error:error instanceof Error?error.message:String(error)};} };
  const [recovery,setRecovery]=useState(readRecovery);
  const intent=recovery.intent;
  const alive=useRef(true),writeFlight=useRef(false);
  useEffect(()=>{
    alive.current=true;
    const changed=()=>setRecovery(readRecovery());
    window.addEventListener('storage',changed);
    return ()=>{alive.current=false;window.removeEventListener('storage',changed);};
  },[owner]);


  const query = useApiQuery<PageResponse<DepositRow | WithdrawalRow>>(
    (signal) => session
      ? api.get(
          `/custody/console/v1/${type}${queryString({
            ...filters,
            limit: pagination.pageSize,
            offset: pagination.offset,
          })}`,
          signal,
        )
      : Promise.resolve(emptyPage(pagination.pageSize, pagination.offset)),
    [
      session?.userId, type, filters.chain, filters.assetSymbol, filters.status,
      filters.search, pagination.pageSize, pagination.offset,
    ],
  );

  const addressQuery = useApiQuery<PageResponse<AddressOption>>(
    (signal) => session && type === 'withdrawals'
      ? api.get('/custody/console/v1/addresses?status=ACTIVE&limit=200', signal)
      : Promise.resolve(emptyPage(200, 0)),
    [session?.userId, type],
  );
  const gasQuery = useApiQuery<GasAccount[]>(
    (signal) => session && type === 'withdrawals'
      ? api.get('/custody/console/v1/gas-accounts', signal)
      : Promise.resolve([]),
    [session?.userId, type],
  );

  const addressOptions = useMemo(
    () => (addressQuery.data?.items ?? [])
      .filter((row) => !['GAS_FUNDING', 'COLLECTION_AND_GAS'].includes(String(row.metadata?.systemPurpose)))
      .map((row) => ({
        value: row.id,
        label: `${row.label || row.subject || row.chain} — ${row.address}`,
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

  const statusOptions = (type === 'deposits'
    ? ['DETECTED', 'CONFIRMING', 'CONFIRMED', 'REORGED', 'FAILED']
    : [
        'CREATED', 'PENDING_REVIEW', 'FROZEN', 'SIGNING', 'SENT',
        'BROADCAST_UNKNOWN', 'CONFIRMED', 'FAILED', 'REJECTED',
      ]).map((value) => ({ value, label: t(value.replaceAll('_', ' ')) }));

  const applyFilters = () => {
    pagination.reset();
    setFilters({
      ...draftFilters,
      assetSymbol: draftFilters.assetSymbol.trim().toUpperCase(),
      search: draftFilters.search.trim(),
    });
  };

  const resetFilters = () => {
    pagination.reset();
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const showFailure=(error:unknown)=>void message.error(error instanceof Error ? error.message : t('Unable to create withdrawal'));
  const createWithdrawal = async (values: WithdrawalValues,retry=false) => {
    if(!session || writeFlight.current)return;
    writeFlight.current=true;setCreating(true);
    try {
      await withWithdrawalLock(owner,async()=>{
        const saved=readWithdrawalIntent(owner);
        if(saved && (!retry || saved.key!==intent?.key)) {
          if(alive.current)setRecovery({intent:saved,error:''});
          throw new Error(t('Reconcile the original withdrawal before creating another.'));
        }
        const original=saved ?? prepareWithdrawalIntent(owner,values);
        if(alive.current)setRecovery({intent:original,error:''});
        if(original.receipt || original.refusal)return;
        const receipt=await apiRequest<Record<string,unknown>>('/custody/console/v1/withdrawals',{
          method:'POST',body:{...original.body,confirmed:true},headers:{'Idempotency-Key':original.key},signal:AbortSignal.timeout(20_000),
        });
        const accepted=acceptWithdrawalIntent(original,receipt);
        if(!alive.current)return;
        setRecovery({intent:accepted,error:''});
        form.resetFields();setPendingWithdrawal(undefined);setDrawerOpen(false);query.refetch();
        void message.success(t('Withdrawal created; principal and the separate gas reserve are frozen'));
      });
    } catch(error){if(alive.current)showFailure(error);}
    finally {writeFlight.current=false;if(alive.current)setCreating(false);}
  };
  const queryOriginal=async()=>{
    if(!intent || writeFlight.current)return;
    writeFlight.current=true;setCreating(true);
    try {
      await withWithdrawalLock(owner,async()=>{
        const current=readWithdrawalIntent(owner);
        if(!current || current.key!==intent.key)throw new Error(t('Original withdrawal changed; reload the page.'));
        const rows=await apiRequest<Record<string,unknown>[]>(`/custody/console/v1/withdrawals/submission?${new URLSearchParams({reference:current.body.externalReference!})}`,{signal:AbortSignal.timeout(20_000)});
        if(!Array.isArray(rows) || rows.length!==1)throw new Error(t('Original result is still unknown. Retry only the original request.'));
        const accepted=acceptWithdrawalIntent(current,rows[0]);
        if(alive.current)setRecovery({intent:accepted,error:''});
      });
    }catch(error){if(alive.current)showFailure(error);}
    finally{writeFlight.current=false;if(alive.current)setCreating(false);}
  };
  const closeUnaccepted=()=>{
    if(!intent || creating)return;
    modal.confirm({title:t('Permanently close an unaccepted request?'),content:t('An accepted withdrawal will stay active. An unaccepted request will be permanently refused under its original reference.'),onOk:async()=>{
      writeFlight.current=true;setCreating(true);
      try {await withWithdrawalLock(owner,async()=>{
        const current=readWithdrawalIntent(owner);
        if(!current || current.key!==intent.key)throw new Error(t('Original withdrawal changed; reload the page.'));
        const response=await apiRequest<Record<string,unknown>>('/custody/console/v1/withdrawals/resolve',{method:'POST',body:{...current.body,confirmed:true},headers:{'Idempotency-Key':current.key},signal:AbortSignal.timeout(20_000)});
        const resolved=await resolveWithdrawalIntent(current,response);
        if(alive.current)setRecovery({intent:resolved,error:''});
      });}catch(error){if(alive.current)showFailure(error);throw error;}
      finally{writeFlight.current=false;if(alive.current)setCreating(false);}
    }});
  };
  const startAnother=async()=>{
    if(!intent || (!intent.receipt && !intent.refusal))return;
    try {await withWithdrawalLock(owner,async()=>{clearWithdrawalIntent(intent);setRecovery({intent:null,error:''});});}
    catch(error){showFailure(error);}
  };

  const depositColumns = [
    {
      title: t('Transaction'),
      dataIndex: 'txHash',
      render: (value: string) => <CopyText value={value} />,
    },
    {
      title: t('Address'),
      dataIndex: 'address',
      width: 360,
      render: (value: string) => <CopyText value={value} compact={false} />,
    },
    { title: t('Network'), dataIndex: 'chain' },
    { title: t('Asset'), dataIndex: 'assetSymbol' },
    {
      title: t('Amount'),
      render: (_: unknown, row: DepositRow) =>
        `${formatAmount(row.amount)} ${row.assetSymbol}`,
    },
    {
      title: t('Subject'),
      dataIndex: 'subject',
      render: (value?: string) => value || '—',
    },
    { title: t('Status'), dataIndex: 'status', render: (value: string) => <StatusText value={value} /> },
    { title: t('Credited'), dataIndex: 'creditedAt', render: formatDate },
  ];

  const withdrawalColumns = [
    {
      title: t('Order'),
      dataIndex: 'orderNo',
      render: (value: string) => <CopyText value={value} />,
    },
    {
      title: t('Source address'),
      dataIndex: 'sourceAddress',
      width: 360,
      render: (value: string) => <CopyText value={value} compact={false} />,
    },
    { title: t('Network'), dataIndex: 'chain' },
    { title: t('Asset'), dataIndex: 'assetSymbol' },
    {
      title: t('Amount'),
      render: (_: unknown, row: WithdrawalRow) =>
        `${formatAmount(row.amount)} ${row.assetSymbol}`,
    },
    {
      title: t('Actual network fee'),
      render: (_: unknown, row: WithdrawalRow) =>
        `${formatAmount(row.networkFee)} ${row.networkFeeAsset ?? ''}`,
    },
    { title: t('Gas status'), dataIndex: 'gasStatus', render: (value?: string) => value || '—' },
    {
      title: t('External reference'),
      dataIndex: 'externalReference',
      render: (value?: string) => value || '—',
    },
    {
      title: t('Destination'),
      dataIndex: 'toAddress',
      width: 360,
      render: (value: string) => <CopyText value={value} compact={false} />,
    },
    { title: t('Transaction'), dataIndex: 'txHash', render: (value?: string) => <CopyText value={value} /> },
    { title: t('Status'), dataIndex: 'status', render: (value: string) => <StatusText value={value} /> },
    { title: t('Created'), dataIndex: 'createdAt', render: formatDate },
  ];

  const title = type === 'deposits' ? t('Deposits') : t('Withdrawals');
  return (
    <div className="page-stack">
      <PageHeader
        title={title}
        description={
          type === 'deposits'
            ? t('Confirmed on-chain deposits attributed to this tenant.')
            : t('Tenant withdrawals and their signing, broadcast, and confirmation state.')
        }
        actions={type === 'withdrawals' && canCreateWithdrawal ? (
          <Button type="primary" aria-label={t('Create withdrawal')} disabled={Boolean(intent)||Boolean(recovery.error)||creating} icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            {t('Create withdrawal')}
          </Button>
        ) : undefined}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {recovery.error ? <Alert type="error" title={recovery.error}/> : intent ? <Alert type={intent.receipt?'info':'warning'} title={t('Original withdrawal')} description={<Space orientation="vertical">
        <span>{intent.body.amount} {intent.body.assetSymbol} · {intent.body.chain} · {intent.receipt?.status ?? (intent.refusal?t('Permanently refused'):t('Result unknown'))}</span>
        <span>{t('Withdrawal beneficiary')}: {intent.body.subject}</span>
        <CopyText value={intent.body.toAddress} compact={false}/><CopyText value={intent.key} compact={false}/>
        <span>{t('Network gas is accounted separately. An unknown result must keep the original reference.')}</span>
        <Space wrap><Button key="query-original" onClick={()=>void queryOriginal()} loading={creating}>{t('Query original request')}</Button>
        {!intent.receipt && !intent.refusal ? <><Button key="retry-original" disabled={creating} onClick={()=>void createWithdrawal(intent.body,true)}>{t('Retry original request')}</Button><Button key="close-original" disabled={creating} onClick={closeUnaccepted}>{t('Close unaccepted request')}</Button></> : <Button key="start-another" disabled={creating} onClick={()=>void startAnother()}>{t('Start another withdrawal')}</Button>}</Space>
      </Space>}/> : null}

      <section className="data-panel">
        <div className="table-toolbar">
          <Select
            allowClear
            aria-label={t('Network')}
            showSearch
            optionFilterProp="label"
            placeholder={t('Network')}
            style={{ minWidth: 150 }}
            options={commonChainOptions}
            value={draftFilters.chain || undefined}
            onChange={(chain = '') => setDraftFilters((current) => ({ ...current, chain }))}
          />
          <Input
            allowClear
            aria-label={t('Asset')}
            placeholder={t('Asset')}
            style={{ width: 130 }}
            value={draftFilters.assetSymbol}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              assetSymbol: event.target.value,
            }))}
            onPressEnter={applyFilters}
          />
          <Select
            allowClear
            aria-label={t('Status')}
            placeholder={t('Status')}
            style={{ minWidth: 190 }}
            options={statusOptions}
            value={draftFilters.status || undefined}
            onChange={(status = '') => setDraftFilters((current) => ({ ...current, status }))}
          />
          <Input
            allowClear
            aria-label={t(type === 'deposits' ? 'Search deposits' : 'Search withdrawals')}
            prefix={<SearchOutlined />}
            placeholder={t(type === 'deposits' ? 'Search deposits' : 'Search withdrawals')}
            style={{ width: 300 }}
            value={draftFilters.search}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              search: event.target.value,
            }))}
            onPressEnter={applyFilters}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>{t('Search')}</Button>
          <Button onClick={resetFilters}>{t('Reset')}</Button>
          <Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button>
        </div>
        {type === 'deposits' ? (
          <Table<DepositRow>
            rowKey="id"
            loading={query.loading}
            dataSource={(query.data?.items ?? []) as DepositRow[]}
            columns={depositColumns}
            pagination={pagination.config(query.data?.total ?? 0)}
            locale={{ emptyText: <Empty description={t('No deposits yet')} /> }}
            scroll={{ x: 1260 }}
          />
        ) : (
          <Table<WithdrawalRow>
            rowKey="id"
            loading={query.loading}
            dataSource={(query.data?.items ?? []) as WithdrawalRow[]}
            columns={withdrawalColumns}
            pagination={pagination.config(query.data?.total ?? 0)}
            locale={{ emptyText: <Empty description={t('No withdrawals yet')} /> }}
            scroll={{ x: 2050 }}
          />
        )}
      </section>

      <Drawer
        title={t('Create withdrawal')}
        size={460}
        open={drawerOpen}
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
      >
        <Form<WithdrawalValues>
          form={form}
          disabled={creating || Boolean(intent)}
          layout="vertical"
          requiredMark={false}
          onFinish={setPendingWithdrawal}
        >
          <Form.Item
            name="custodyAddressId"
            label={t('Source custody address')}
            rules={[{ required: true, message: t('Select the tenant address account to debit') }]}
          >
            <Select
              showSearch
              loading={addressQuery.loading}
              options={addressOptions}
              optionFilterProp="label"
              onChange={(value) => {
                const selected = addressOptions.find((item) => item.value === value)?.row;
                if (selected) form.setFieldsValue({ chain: selected.chain, subject: selected.subject });
              }}
            />
          </Form.Item>
          <Form.Item name="subject" label={t('Withdrawal beneficiary')} rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={160} placeholder="user:42" />
          </Form.Item>
          <Form.Item name="chain" label={t('Network')} rules={[{ required: true }]}>
            <Input readOnly />
          </Form.Item>
          <Form.Item
            name="assetSymbol"
            label={t('Asset')}
            rules={[{ required: true, message: t('Enter the enabled asset symbol') }]}
          >
            <Input placeholder="USDT" />
          </Form.Item>
          <Form.Item
            name="toAddress"
            label={t('Destination address')}
            rules={[{ required: true, message: t('Enter a destination address') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="amount"
            label={t('Amount')}
            rules={[{ required: true, message: t('Enter a positive amount') }]}
          >
            <InputNumber<string>
              stringMode
              min="0.000000000000000001"
              controls={false}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="externalReference" label={t('External reference (optional)')}>
            <Input maxLength={160} placeholder="payout-2026-00421" />
          </Form.Item>
          <div className="form-warning">
            {t('Principal is frozen in the selected address account. Network gas is reserved separately in the tenant gas account and settled from the actual chain receipt.')}
          </div>
          {selectedChain ? (
            selectedGas ? (
              <Alert
                showIcon
                type={selectedGas.lowBalance ? 'warning' : 'success'}
                title={t('{chain} gas balance: {balance} {symbol}', { chain: selectedGas.chain, balance: formatAmount(selectedGas.availableBalance), symbol: selectedGas.nativeSymbol })}
                description={selectedGas.lowBalance
                  ? t('The reserve is below its warning threshold. Funding it before a busy payout window is recommended.')
                  : t('A conservative network-fee amount will be locked when you confirm.')}
              />
            ) : (
              <Alert
                showIcon
                type="error"
                title={t('No funded {chain} gas reserve', { chain: selectedChain })}
                description={t('Generate and fund this chain address from Chains before requesting a withdrawal.')}
              />
            )
          ) : null}
          <Button type="primary" htmlType="submit" block disabled={Boolean(selectedChain) && !gasReady}>
            {t('Review withdrawal')}
          </Button>
        </Form>
      </Drawer>

      <Modal
        title={t('Confirm withdrawal')}
        open={Boolean(pendingWithdrawal)}
        zIndex={1300}
        confirmLoading={creating}
        okText={t('Confirm and freeze funds')}
        cancelText={t('Go back')}
        onOk={() => pendingWithdrawal && void createWithdrawal(pendingWithdrawal)}
        onCancel={() => setPendingWithdrawal(undefined)}
      >
        {pendingWithdrawal ? (
          <div className="withdrawal-confirmation">
            <Alert
              showIcon
              type="warning"
              title={t('Check every value carefully')}
              description={t('After broadcast, a blockchain withdrawal cannot be reversed. The source asset and a conservative tenant gas reserve are frozen atomically when you confirm.')}
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('Network')}>
                {pendingWithdrawal.chain}
              </Descriptions.Item>
              <Descriptions.Item label={t('Asset')}>
                {pendingWithdrawal.assetSymbol}
              </Descriptions.Item>
              <Descriptions.Item label={t('Withdrawal beneficiary')}>
                {pendingWithdrawal?.subject}
              </Descriptions.Item>
              <Descriptions.Item label={t('Amount')}>
                {pendingWithdrawal.amount} {pendingWithdrawal.assetSymbol}
              </Descriptions.Item>
              <Descriptions.Item label={t('Destination')}>
                <CopyText value={pendingWithdrawal.toAddress} compact={false} />
              </Descriptions.Item>
              <Descriptions.Item label={t('External reference')}>
                {pendingWithdrawal.externalReference || '—'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
