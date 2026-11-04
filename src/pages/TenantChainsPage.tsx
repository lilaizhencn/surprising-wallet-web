import { useState } from 'react';
import { Alert, App, Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { hasRole, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';

type TenantToken = {
  symbol: string;
  standard: string;
  contractAddress: string;
  decimals: number;
  platformEnabled: boolean;
};

type TenantChain = {
  chain: string;
  network: string;
  family: string;
  nativeSymbol: string;
  platformEnabled?: boolean;
  eip7702Enabled: boolean;
  tokens: TenantToken[];
  status: string;
  enabled: boolean;
  withdrawalPaused: boolean;
  scanEnabled: boolean;
  withdrawalEnabled: boolean;
  transferEnabled: boolean;
  collectionAddressId?: string;
  collectionAddress?: string;
  memo?: string;
  openedAt?: string;
  closedAt?: string;
};

type HotWalletPolicy = {
  assetSymbol: string;
  targetBalance: string;
  maximumBalance: string;
  maximumSingleWithdrawal: string;
  maximum24hWithdrawal: string;
};

type AggregateHotWalletLimit = {
  tenantId: string;
  chain: string;
  assetSymbol: string;
  maximumActiveBalance: string;
};

type StandbyHotWallet = {
  id: string;
  chain: string;
  address: string;
  label: string;
  status: string;
  routePriority: number;
  quarantineFenceConfirmed: boolean;
  policies: HotWalletPolicy[];
};

type HotInventory = {
  walletId: string;
  assetSymbol: string;
  observedBalance: string;
  nativeBalance: string;
  targetBalance: string;
  maximumBalance: string;
  overMaximum: boolean;
  observedAt: string;
  observedBlockHeight: number | null;
  observedBlockHash: string | null;
};

type ReconciledSpend = {
  walletId: string;
  orderNo: string;
  txHash: string;
  observedBlockHeight: number;
  observedBlockHash: string;
  remainingCommittedExposure: string;
  newlyAccounted: boolean;
};

type ReconciledCollection = {
  walletId: string;
  collectionNo: string;
  txHash: string;
  remainingInboundExposure: string;
  newlyAccounted: boolean;
};

type CollectionRulePreflight = {
  independentPolicies: { assetSymbol: string; destinationAddress: string; ruleId: string }[];
};

type IncidentInventory = {
  walletId: string;
  chain: string;
  address: string;
  assets: { assetSymbol: string; tokenIdentifier: string | null;
    observedBalance: string; observedNativeBalance: string;
    observedAt: string; accountCodeState: string | null; delegatedTo: string | null;
    observedBlockHash: string | null }[];
  rescueReadiness: 'NO_INDEPENDENT_RECOVERY_AUTHORITY';
  assetTransferComplete: false;
};

function StandbyWalletManager({ chain, onClose, onChainStateChanged, canManage }:
  { chain: TenantChain; onClose: () => void; onChainStateChanged: () => void; canManage: boolean }) {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [quarantineTarget, setQuarantineTarget] = useState<StandbyHotWallet>();
  const [observations, setObservations] = useState<Record<string, HotInventory>>({});
  const [preflight, setPreflight] = useState<Record<string, CollectionRulePreflight>>({});
  const [incidentInventories, setIncidentInventories] = useState<Record<string, IncidentInventory>>({});
  const [reconciledSpend, setReconciledSpend] = useState<ReconciledSpend>();
  const [reconciledCollection, setReconciledCollection] = useState<ReconciledCollection>();
  const [createForm] = Form.useForm<{ label: string }>();
  const [policyForm] = Form.useForm<HotWalletPolicy & { walletId: string }>();
  const [aggregateForm] = Form.useForm<{ assetSymbol: string; maximumActiveBalance: string }>();
  const [quarantineForm] = Form.useForm<{ reason: string }>();
  const [switchForm] = Form.useForm<{ oldWalletId: string; standbyWalletId: string;
    routePriority: number; reason: string }>();
  const [reconcileForm] = Form.useForm<{ walletId: string; orderNo: string }>();
  const [collectionReconcileForm] = Form.useForm<{ walletId: string; collectionNo: string }>();
  const query = useApiQuery<StandbyHotWallet[]>((signal) => api.get(
    `/custody/console/v1/hot-wallets?chain=${encodeURIComponent(chain.chain)}`, signal), [chain.chain]);
  const aggregateQuery = useApiQuery<AggregateHotWalletLimit[]>((signal) => api.get(
    `/custody/console/v1/hot-wallets/exposure-limits?chain=${encodeURIComponent(chain.chain)}`, signal), [chain.chain]);

  const setAggregateLimit = async (values: { assetSymbol: string; maximumActiveBalance: string }) => {
    setBusy(true);
    try {
      await api.put(`/custody/console/v1/hot-wallets/exposure-limits/${encodeURIComponent(chain.chain)}/${encodeURIComponent(values.assetSymbol)}`,
        { maximumActiveBalance: values.maximumActiveBalance });
      aggregateForm.resetFields();
      aggregateQuery.refetch();
      void message.success(t('Aggregate hot wallet limit saved'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save aggregate hot wallet limit'));
    } finally { setBusy(false); }
  };

  const create = async ({ label }: { label: string }) => {
    setBusy(true);
    try {
      await api.post('/custody/console/v1/hot-wallets', { chain: chain.chain, label: label.trim() });
      createForm.resetFields();
      query.refetch();
      void message.success(t('Standby address created'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to create standby address'));
    } finally { setBusy(false); }
  };

  const setPolicy = async (values: HotWalletPolicy & { walletId: string }) => {
    setBusy(true);
    try {
      await api.put(`/custody/console/v1/hot-wallets/${values.walletId}/policies/${values.assetSymbol}`, {
        targetBalance: values.targetBalance,
        maximumBalance: values.maximumBalance,
        maximumSingleWithdrawal: values.maximumSingleWithdrawal,
        maximum24hWithdrawal: values.maximum24hWithdrawal,
      });
      policyForm.resetFields();
      setPreflight(current => { const next = { ...current }; delete next[values.walletId]; return next; });
      setObservations(current => {
        const next = { ...current };
        delete next[`${values.walletId}:${values.assetSymbol}`];
        return next;
      });
      query.refetch();
      void message.success(t('Standby limits saved'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save standby limits'));
    } finally { setBusy(false); }
  };

  const quarantine = async ({ reason }: { reason: string }) => {
    if (!quarantineTarget) return;
    setBusy(true);
    try {
      await api.post(`/custody/console/v1/hot-wallets/${quarantineTarget.id}/quarantine`,
        { reason: reason.trim() });
      setQuarantineTarget(undefined);
      quarantineForm.resetFields();
      setPreflight(current => { const next = { ...current }; delete next[quarantineTarget.id]; return next; });
      setObservations(current => Object.fromEntries(Object.entries(current)
        .filter(([key]) => !key.startsWith(`${quarantineTarget.id}:`))));
      query.refetch();
      onChainStateChanged();
      void message.success(t('Hot wallet quarantined'));
    } catch (error) {
      query.refetch();
      onChainStateChanged();
      void message.error(t(error instanceof Error ? error.message : 'Unable to quarantine hot wallet'));
    } finally { setBusy(false); }
  };

  const refreshInventory = async (walletId: string, asset: string) => {
    setBusy(true);
    try {
      const observed = await api.post<HotInventory>(
        `/custody/console/v1/hot-wallets/${walletId}/inventory/${encodeURIComponent(asset)}/refresh`, {});
      setObservations(current => ({ ...current, [`${walletId}:${asset}`]: observed }));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to refresh hot wallet inventory'));
    } finally { setBusy(false); }
  };

  const reconcileConfirmedSpend = async ({ walletId, orderNo }:
    { walletId: string; orderNo: string }) => {
    setBusy(true);
    try {
      const result = await api.post<ReconciledSpend>(
        `/custody/console/v1/hot-wallets/${walletId}/confirmed-spends/${encodeURIComponent(orderNo.trim())}/reconcile`, {});
      setReconciledSpend(result);
      reconcileForm.resetFields();
      void message.success(t('Confirmed withdrawal reconciled to finalized chain balance'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to reconcile confirmed withdrawal'));
    } finally { setBusy(false); }
  };

  const reconcileConfirmedCollection = async ({ walletId, collectionNo }:
    { walletId: string; collectionNo: string }) => {
    setBusy(true);
    try {
      const result = await api.post<ReconciledCollection>(
        `/custody/console/v1/hot-wallets/${walletId}/confirmed-collections/${encodeURIComponent(collectionNo.trim())}/reconcile`, {});
      setReconciledCollection(result);
      collectionReconcileForm.resetFields();
      void message.success(t('Confirmed collection reconciled to finalized receiving balance'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to reconcile confirmed collection'));
    } finally { setBusy(false); }
  };

  const checkCollectionRules = async (walletId: string) => {
    setBusy(true);
    try {
      const checked = await api.post<CollectionRulePreflight>(
        `/custody/console/v1/hot-wallets/${walletId}/collection-rule-preflight`, {});
      setPreflight(current => ({ ...current, [walletId]: checked }));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to check independent collection rules'));
    } finally { setBusy(false); }
  };

  const activate = async (walletId: string) => {
    setBusy(true);
    try {
      await api.post(`/custody/console/v1/hot-wallets/${walletId}/activate`, { routePriority: 100 });
      setPreflight(current => { const next = { ...current }; delete next[walletId]; return next; });
      query.refetch();
      void message.success(t('Hot wallet activated for new collections and withdrawals'));
    } catch (error) {
      query.refetch();
      void message.error(t(error instanceof Error ? error.message : 'Unable to activate hot wallet'));
    } finally { setBusy(false); }
  };

  const emergencySwitch = async (values: { oldWalletId: string; standbyWalletId: string;
    routePriority: number; reason: string }) => {
    setBusy(true);
    try {
      await api.post('/custody/console/v1/hot-wallets/emergency-switch', values);
      switchForm.resetFields();
      query.refetch();
      onChainStateChanged();
      void message.success(t('Old key quarantined and replacement routes activated. Withdrawals remain paused; assets were not moved.'));
    } catch (error) {
      query.refetch();
      onChainStateChanged();
      void message.error(t(error instanceof Error ? error.message : 'Emergency route switch is incomplete; withdrawals remain paused'));
    } finally { setBusy(false); }
  };

  const inspectIncidentInventory = async (walletId: string) => {
    setBusy(true);
    try {
      const observed = await api.get<IncidentInventory>(
        `/custody/console/v1/hot-wallets/${walletId}/incident-inventory`);
      setIncidentInventories(current => ({ ...current, [walletId]: observed }));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to inspect quarantined wallet inventory'));
    } finally { setBusy(false); }
  };

  return <Modal open title={t('{chain} hot wallets', { chain: chain.chain })}
    width={900} onCancel={onClose} footer={<Button onClick={onClose}>{t('Close')}</Button>}>
    <Alert showIcon type="info"
      title={t('Activate a configured standby wallet after independent destination rules and fresh chain balances pass. New collections and withdrawals then use active wallets.')} />
    <ErrorState message={query.error} onRetry={query.refetch} />
    <ErrorState message={aggregateQuery.error} onRetry={aggregateQuery.refetch} />
    <Typography.Text strong>{t('Active hot wallet aggregate limits')}</Typography.Text>
    <div>{aggregateQuery.data?.length
      ? aggregateQuery.data.map(limit => <Tag key={limit.assetSymbol}>
        {limit.assetSymbol}: {limit.maximumActiveBalance}</Tag>)
      : t('Set an aggregate limit for each asset before activation')}</div>
    <Table<StandbyHotWallet> rowKey="id" size="small" loading={query.loading}
      pagination={false} dataSource={query.data ?? []} columns={[
        { title: t('Label'), dataIndex: 'label' },
        { title: t('Address'), render: (_, row) => <CopyText value={row.address} compact /> },
        { title: t('Status'), render: (_, row) => <Space direction="vertical" size={0}>
          <Tag>{t(row.status)}</Tag>
          {row.status === 'QUARANTINED' && !row.quarantineFenceConfirmed
            && <Typography.Text type="danger">{t('Hot wallet security fence pending')}</Typography.Text>}
          {row.status === 'QUARANTINED' && row.quarantineFenceConfirmed
            && <Typography.Text type="warning">{t('Old address assets have not been moved')}</Typography.Text>}
        </Space> },
        { title: t('Asset limits'), render: (_, row) => row.policies.length
          ? row.policies.map(policy => <div key={policy.assetSymbol}>
            {policy.assetSymbol}: {policy.targetBalance} / {policy.maximumBalance}
            {row.status !== 'QUARANTINED' && <Button type="link" size="small" disabled={busy}
              onClick={() => void refreshInventory(row.id, policy.assetSymbol)}>{t('Refresh chain balance')}</Button>}
            {observations[`${row.id}:${policy.assetSymbol}`] && <div>
              {t('Observed balance')}: {observations[`${row.id}:${policy.assetSymbol}`].observedBalance}
              {' · '}{new Date(observations[`${row.id}:${policy.assetSymbol}`].observedAt).toLocaleString()}
              {observations[`${row.id}:${policy.assetSymbol}`].observedBlockHeight != null && <>
                {' · '}{t('Observed block')}: {observations[`${row.id}:${policy.assetSymbol}`].observedBlockHeight}
                {' / '}<CopyText value={observations[`${row.id}:${policy.assetSymbol}`].observedBlockHash} />
              </>}
              {observations[`${row.id}:${policy.assetSymbol}`].overMaximum
                && <Tag color="red">{t('Above maximum balance')}</Tag>}
            </div>}
          </div>) : t('Not configured') },
        { title: t('Action'), render: (_, row) => <Space direction="vertical" size={4}>
          {row.status === 'STANDBY' && <Button size="small" disabled={busy}
            onClick={() => void checkCollectionRules(row.id)}>{t('Check collection rules')}</Button>}
          {preflight[row.id] && <Typography.Text type="success">
            {t('Independent rules verified for {count} assets',
              { count: preflight[row.id].independentPolicies.length })}
          </Typography.Text>}
          {canManage && row.status === 'STANDBY' && <Button size="small" type="primary"
            disabled={busy || !row.policies.length} onClick={() => void activate(row.id)}>
            {t('Activate routes')}
          </Button>}
          {row.status === 'ACTIVE' && <Typography.Text type="secondary">
            {t('Route priority')}: {row.routePriority}
          </Typography.Text>}
          {row.status === 'QUARANTINED' && row.quarantineFenceConfirmed && <Button size="small"
            disabled={busy} onClick={() => void inspectIncidentInventory(row.id)}>
            {t('Inspect old chain inventory')}
          </Button>}
          {incidentInventories[row.id] && <div>
            <Typography.Text type="warning">{t('Configured asset balances only; scan unknown tokens separately')}</Typography.Text>
            {incidentInventories[row.id].rescueReadiness === 'NO_INDEPENDENT_RECOVERY_AUTHORITY'
              && <div><Typography.Text type="danger">
                {t('No independent on-chain rescue authority is installed; this workflow cannot move the old assets')}
              </Typography.Text></div>}
            {incidentInventories[row.id].assets.map(asset => <div key={asset.assetSymbol}>
              {asset.assetSymbol}: {asset.observedBalance}
              {asset.tokenIdentifier && <Typography.Text code>
                {' · '}{asset.tokenIdentifier}
              </Typography.Text>}
              {' · '}{new Date(asset.observedAt).toLocaleString()}
              {asset.accountCodeState === 'EIP7702_DELEGATED' && <Typography.Text type="danger">
                {' · '}{t('EIP-7702 delegation detected')}: {asset.delegatedTo}
              </Typography.Text>}
              {asset.accountCodeState === 'UNRECOGNIZED_CODE' && <Typography.Text type="danger">
                {' · '}{t('Unexpected account code detected')}
              </Typography.Text>}
              {asset.observedBlockHash && <Typography.Text type="secondary">
                {' · '}{t('Observed block')}: {asset.observedBlockHash}
              </Typography.Text>}
            </div>)}
          </div>}
          {!canManage ? null
          : row.status === 'QUARANTINED' && !row.quarantineFenceConfirmed
            ? <Button danger size="small" loading={busy} onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/custody/console/v1/hot-wallets/${row.id}/quarantine`,
                  { reason: 'retry independent key quarantine' });
                query.refetch();
                onChainStateChanged();
                void message.success(t('Hot wallet quarantined'));
              } catch (error) {
                query.refetch();
                onChainStateChanged();
                void message.error(t(error instanceof Error ? error.message : 'Unable to quarantine hot wallet'));
              } finally { setBusy(false); }
            }}>{t('Retry hot wallet fence')}</Button>
            : row.status !== 'QUARANTINED'
              ? <Button danger size="small" onClick={() => setQuarantineTarget(row)}>{t('Quarantine')}</Button>
              : null}
        </Space> },
      ]} />
    {quarantineTarget && <Form form={quarantineForm} name="hot-wallet-quarantine" layout="vertical" onFinish={quarantine}
      style={{ marginTop: 16 }}>
        <Typography.Text strong>{t('Quarantine hot wallet')}: {quarantineTarget.label}</Typography.Text>
        <Typography.Paragraph type="warning">
          {t('Quarantining this wallet also pauses withdrawals on this chain.')}
        </Typography.Paragraph>
        <Form.Item name="reason" label={t('Reason')}
          rules={[{ required: true, whitespace: true, min: 8, max: 500 }]}>
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>
        <Space>
          <Button danger htmlType="submit" loading={busy}>{t('Quarantine')}</Button>
          <Button onClick={() => { setQuarantineTarget(undefined); quarantineForm.resetFields(); }}>
            {t('Cancel')}
          </Button>
        </Space>
      </Form>}
    {canManage && <>
    <Form form={aggregateForm} layout="inline" onFinish={setAggregateLimit} style={{ marginTop: 16 }}>
      <Form.Item name="assetSymbol" label={t('Asset')} rules={[{ required: true }]}>
        <Select style={{ width: 140 }} options={[chain.nativeSymbol, ...chain.tokens
          .filter(token => token.platformEnabled).map(token => token.symbol)]
          .map(symbol => ({ value: symbol, label: symbol }))} />
      </Form.Item>
      <Form.Item name="maximumActiveBalance" label={t('Maximum active wallet total')}
        rules={[{ required: true, pattern: /^\d+(?:\.\d+)?$/ }]}>
        <Input style={{ width: 190 }} inputMode="decimal" />
      </Form.Item>
      <Button htmlType="submit" loading={busy}>{t('Save aggregate limit')}</Button>
    </Form>
    <Form form={createForm} layout="inline" onFinish={create} style={{ marginTop: 16 }}>
      <Form.Item name="label" label={t('New standby label')}
        rules={[{ required: true, whitespace: true, max: 160 }]}><Input maxLength={160} /></Form.Item>
      <Button htmlType="submit" type="primary" loading={busy}>{t('Create standby address')}</Button>
    </Form>
    {(query.data?.some(row => row.status === 'STANDBY') ?? false) && <Form form={policyForm} layout="vertical"
      onFinish={setPolicy} style={{ marginTop: 24 }}>
      <Typography.Text strong>{t('Set standby asset limits')}</Typography.Text>
      <Space wrap align="end">
        <Form.Item name="walletId" label={t('Wallet')} rules={[{ required: true }]}>
          <Select style={{ width: 180 }} options={query.data?.filter(row => row.status === 'STANDBY')
            .map(row => ({ value: row.id, label: row.label }))} />
        </Form.Item>
        <Form.Item name="assetSymbol" label={t('Asset')} rules={[{ required: true }]}>
          <Select style={{ width: 130 }} options={[chain.nativeSymbol, ...chain.tokens
            .filter(token => token.platformEnabled).map(token => token.symbol)]
            .map(symbol => ({ value: symbol, label: symbol }))} />
        </Form.Item>
        {([
          ['targetBalance', 'Target balance'], ['maximumBalance', 'Maximum balance'],
          ['maximumSingleWithdrawal', 'Maximum single withdrawal'],
          ['maximum24hWithdrawal', 'Maximum 24h withdrawal'],
        ] as const).map(([name, label]) => <Form.Item key={name} name={name} label={t(label)}
          rules={[{ required: true, pattern: /^\d+(?:\.\d+)?$/ }]}>
          <Input style={{ width: 150 }} inputMode="decimal" />
        </Form.Item>)}
        <Button htmlType="submit" loading={busy}>{t('Save limits')}</Button>
      </Space>
    </Form>}
    {canManage && chain.family.toLowerCase() === 'evm'
      && (query.data?.some(row => row.status === 'ACTIVE') ?? false)
      && <Form form={reconcileForm} layout="vertical" onFinish={reconcileConfirmedSpend}
        initialValues={{ walletId: query.data?.find(row => row.status === 'ACTIVE')?.id }}
        style={{ marginTop: 24 }}>
        <Typography.Text strong>{t('Reconcile confirmed withdrawal')}</Typography.Text>
        <Typography.Paragraph type="secondary">
          {t('Direct EVM withdrawals only. The original payment and finalized balance are checked independently.')}
        </Typography.Paragraph>
        <Space wrap align="end">
          <Form.Item name="walletId" label={t('Wallet')} rules={[{ required: true }]}>
            <Select style={{ width: 200 }} options={query.data?.filter(row => row.status === 'ACTIVE')
              .map(row => ({ value: row.id, label: row.label }))} />
          </Form.Item>
          <Form.Item name="orderNo" label={t('Original withdrawal order')}
            rules={[{ required: true, pattern: /^[A-Za-z0-9_-]{1,96}$/ }]}>
            <Input style={{ width: 240 }} maxLength={96} />
          </Form.Item>
          <Button htmlType="submit" loading={busy}>{t('Verify finalized payment')}</Button>
        </Space>
        {reconciledSpend && <Typography.Paragraph type="success">
          {t('Observed block')}: {reconciledSpend.observedBlockHeight}
          {' · '}{t('Remaining committed exposure')}: {reconciledSpend.remainingCommittedExposure}
          {' · '}<CopyText value={reconciledSpend.txHash} />
        </Typography.Paragraph>}
      </Form>}
    {canManage && chain.family.toLowerCase() === 'evm'
      && (query.data?.some(row => row.status === 'ACTIVE') ?? false)
      && <Form form={collectionReconcileForm} layout="vertical" onFinish={reconcileConfirmedCollection}
        initialValues={{ walletId: query.data?.find(row => row.status === 'ACTIVE')?.id }}
        style={{ marginTop: 24 }}>
        <Typography.Text strong>{t('Reconcile confirmed collection')}</Typography.Text>
        <Typography.Paragraph type="secondary">
          {t('Direct EVM collections only. The source transfer and receiving balance are checked independently.')}
        </Typography.Paragraph>
        <Space wrap align="end">
          <Form.Item name="walletId" label={t('Wallet')} rules={[{ required: true }]}>
            <Select style={{ width: 200 }} options={query.data?.filter(row => row.status === 'ACTIVE')
              .map(row => ({ value: row.id, label: row.label }))} />
          </Form.Item>
          <Form.Item name="collectionNo" label={t('Original collection reference')}
            rules={[{ required: true, pattern: /^[A-Za-z0-9_-]{1,96}$/ }]}>
            <Input style={{ width: 240 }} maxLength={96} />
          </Form.Item>
          <Button htmlType="submit" loading={busy}>{t('Verify finalized receipt')}</Button>
        </Space>
        {reconciledCollection && <Typography.Paragraph type="success">
          {t('Remaining inbound exposure')}: {reconciledCollection.remainingInboundExposure}
          {' · '}<CopyText value={reconciledCollection.txHash} />
        </Typography.Paragraph>}
      </Form>}
    {canManage && (query.data?.some(row => row.status === 'ACTIVE') ?? false)
      && (query.data?.some(row => row.status === 'STANDBY') ?? false) &&
      <Form form={switchForm} layout="vertical" onFinish={emergencySwitch}
        initialValues={{ routePriority: 100 }} style={{ marginTop: 24 }}>
        <Typography.Text strong>{t('Emergency quarantine and route switch')}</Typography.Text>
        <Alert showIcon type="warning" style={{ marginTop: 8, marginBottom: 12 }}
          title={t('This pauses withdrawals, quarantines the old key on all signers, then activates the replacement. Assets stay at their current on-chain addresses.')} />
        <Space wrap align="end">
          <Form.Item name="oldWalletId" label={t('Compromised active wallet')} rules={[{ required: true }]}>
            <Select style={{ width: 180 }} options={(query.data ?? []).filter(row => row.status === 'ACTIVE')
              .map(row => ({ value: row.id, label: row.label }))} />
          </Form.Item>
          <Form.Item name="standbyWalletId" label={t('Safe standby wallet')} rules={[{ required: true }]}>
            <Select style={{ width: 180 }} options={(query.data ?? []).filter(row => row.status === 'STANDBY')
              .map(row => ({ value: row.id, label: row.label }))} />
          </Form.Item>
          <Form.Item name="routePriority" label={t('Route priority')}
            rules={[{ required: true, type: 'number', min: 0, max: 1000000 }]}>
            <InputNumber min={0} max={1000000} precision={0} />
          </Form.Item>
          <Form.Item name="reason" label={t('Reason')}
            rules={[{ required: true, whitespace: true, min: 8, max: 500 }]}>
            <Input style={{ width: 260 }} maxLength={500} />
          </Form.Item>
          <Button danger htmlType="submit" loading={busy}>{t('Pause, quarantine and switch')}</Button>
        </Space>
      </Form>}
    </>}
  </Modal>;
}

export default function TenantChainsPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [saving, setSaving] = useState<string>();
  const [slow, setSlow] = useState(false);
  const [pauseTarget, setPauseTarget] = useState<TenantChain>();
  const [walletChain, setWalletChain] = useState<TenantChain>();
  const [pauseForm] = Form.useForm<{ reason: string }>();
  const canManage = hasRole(session, 'TENANT_ADMIN');
  const query = useApiQuery<TenantChain[]>((signal) => session
    ? api.get('/custody/console/v1/chains', signal)
    : Promise.resolve([]), [session?.userId]);

  const toggleChain = async (row: TenantChain, enabled: boolean) => {
    const key = `chain:${row.chain}`;
    setSaving(key);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    try {
      await api.put(`/custody/console/v1/chains/${row.chain}`, { enabled });
      query.refetch();
      void message.success(t(enabled ? 'Chain opened' : 'Chain closed'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update chain'));
    } finally {
      window.clearTimeout(slowTimer);
      setSaving(undefined);
      setSlow(false);
    }
  };

  const generateAddress = async (chain: string) => {
    const key = `address:${chain}`;
    setSaving(key);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    try {
      await api.post('/custody/console/v1/gas-accounts', { chain });
      query.refetch();
      void message.success(t('{chain} hot withdrawal wallet generated', { chain }));
    } catch (error) {
      void message.error(error instanceof Error
        ? error.message
        : t('Unable to generate hot withdrawal wallet'));
    } finally {
      window.clearTimeout(slowTimer);
      setSaving(undefined);
      setSlow(false);
    }
  };

  const changeWithdrawalPause = async ({ reason }: { reason: string }) => {
    if (!pauseTarget) return;
    const target = pauseTarget;
    setSaving(`pause:${target.chain}`);
    try {
      await api.put(`/custody/console/v1/chains/${target.chain}/withdrawals/pause`, {
        paused: !target.withdrawalPaused, reason: reason.trim(),
      });
      setPauseTarget(undefined);
      pauseForm.resetFields();
      query.refetch();
      void message.success(t(target.withdrawalPaused ? 'Withdrawals resumed' : 'Withdrawals paused'));
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update withdrawals'));
    } finally {
      setSaving(undefined);
    }
  };

  const tokenArea = (chain: TenantChain) => (
    <div className="tenant-token-area">
      <div className="tenant-token-heading">
        <div>
          <Typography.Text strong>{t('Available tokens')}</Typography.Text>
          <Typography.Text type="secondary">
            {t('Opening {chain} automatically enables every token supported by the platform.', { chain: chain.chain })}
          </Typography.Text>
        </div>
        {!chain.scanEnabled || !chain.withdrawalEnabled ? (
          <Tag color="warning">{t('Limited by platform operations')}</Tag>
        ) : null}
      </div>
      <Table<TenantToken>
        rowKey="symbol"
        size="small"
        pagination={false}
        dataSource={chain.tokens}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('Native asset only')} /> }}
        columns={[
          {
            title: t('Token'),
            render: (_, token) => (
              <Space>
                <AssetLogo symbol={token.symbol} size={24} />
                <span>
                  <Typography.Text strong>{token.symbol}</Typography.Text><br />
                  <Typography.Text type="secondary">{token.standard}</Typography.Text>
                </span>
              </Space>
            ),
          },
          {
            title: t('Availability'),
            width: 180,
            render: (_, token) => (
              <Tag color={token.platformEnabled && chain.enabled ? 'green' : 'default'}>
                {t(token.platformEnabled
                  ? (chain.enabled ? 'Enabled with chain' : 'Enabled when chain opens')
                  : 'Platform unavailable')}
              </Tag>
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <div className="page-stack tenant-chains-page">
      <PageHeader
        title={t('Chains')}
        description={t('Open a chain to enable its supported tokens and generate its hot withdrawal wallet and Gas funding address.')}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      {saving && <Alert
        showIcon
        icon={<Spin size="small" />}
        type="info"
        role="status"
        title={t(saving.startsWith('address:') ? 'Generating {chain} hot withdrawal wallet' : 'Updating {chain} chain', { chain: saving.split(':')[1] })}
        description={t(slow ? 'Still processing. Please keep this page open; the result will appear when the request finishes.' : 'Processing your request. This can take a little while.')}
      />}
      <Alert
        showIcon
        type="info"
        title={t('Hot withdrawal wallet and Gas rules')}
        description={t('Fund the generated wallet with the network native coin. Non-EIP-7702 token collection funds the deposit address before collection; EIP-7702 uses sponsored execution and includes authorization only when the address has no approved delegation.')}
      />
      <section className="data-panel tenant-chains-panel">
        <Table<TenantChain>
          rowKey="chain"
          loading={query.loading}
          dataSource={query.data ?? []}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: <Empty description={t('No executable platform chains are available')} /> }}
          expandable={{
            expandedRowRender: tokenArea,
            rowExpandable: (row) => row.tokens.length > 0,
          }}
          columns={[
            {
              title: t('Chain'),
              width: 150,
              render: (_, row) => (
                <Space>
                  <ChainLogo chain={row.chain} size={32} />
                  <span><Typography.Text strong>{row.chain}</Typography.Text><br /><small>{row.network}</small></span>
                </Space>
              ),
            },
            { title: t('Native asset'), width: 120, render: (_, row) => (
              <Space><AssetLogo symbol={row.nativeSymbol} size={22} />{row.nativeSymbol}</Space>
            ) },
            { title: t('Status'), width: 130, render: (_, row) => <Space orientation="vertical" size={2}>
              <StatusText value={row.status} />
              {row.withdrawalPaused && <Tag color="red">{t('Withdrawals paused')}</Tag>}
              {row.platformEnabled === false && <Tag>{t('Platform unavailable')}</Tag>}
            </Space> },
            {
              title: t('Platform operations'),
              width: 160,
              render: (_, row) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={row.scanEnabled ? 'green' : 'default'}>{t('Deposits')}</Tag>
                  <Tag color={row.withdrawalEnabled ? 'green' : 'default'}>{t('Withdrawals')}</Tag>
                </Space>
              ),
            },
            {
              title: t('Hot withdrawal wallet / Gas address'),
              dataIndex: 'collectionAddress',
              className: 'collection-address-cell',
              width: 360,
              render: (_: unknown, row) => (
                <Space orientation="vertical" size={4}>
                  {row.collectionAddress
                    ? <CopyText value={row.collectionAddress} compact={false} />
                    : <Typography.Text type="secondary">{t('Not generated')}</Typography.Text>}
                  <Tag color={row.eip7702Enabled ? 'cyan' : 'gold'}>
                    {t(row.eip7702Enabled ? 'EIP-7702 sponsored Gas' : 'Address-funded Gas')}
                  </Tag>
                </Space>
              ),
            },
            {
              title: t('Action'),
              width: 250,
              render: (_, row) => (
                <Space size={[12, 8]} wrap>
                  <Switch
                    checked={row.enabled}
                    disabled={!canManage || row.platformEnabled === false || saving !== undefined}
                    loading={saving === `chain:${row.chain}`}
                    onChange={(enabled) => void toggleChain(row, enabled)}
                    aria-label={`${row.chain} ${t('Action')}`}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    aria-label={`${row.collectionAddress ? t('Address generated') : t('Generate address')} ${row.chain}`}
                    disabled={!canManage || row.platformEnabled === false || !row.enabled || Boolean(row.collectionAddress)
                      || saving !== undefined}
                    loading={saving === `address:${row.chain}`}
                    onClick={() => void generateAddress(row.chain)}
                  >
                    {row.collectionAddress ? t('Hot wallet generated') : t('Generate hot withdrawal wallet')}
                  </Button>
                  <Button
                    danger={!row.withdrawalPaused}
                    disabled={!canManage || saving !== undefined
                      || (row.platformEnabled === false && row.withdrawalPaused)}
                    onClick={() => setPauseTarget(row)}
                  >
                    {t(row.withdrawalPaused ? 'Resume withdrawals' : 'Emergency pause')}
                  </Button>
                  <Button disabled={!row.enabled || saving !== undefined}
                    onClick={() => setWalletChain(row)}>{t('Standby wallets')}</Button>
                </Space>
              ),
            },
          ]}
        />
      </section>
      {walletChain && <StandbyWalletManager chain={walletChain} canManage={canManage}
        onChainStateChanged={query.refetch}
        onClose={() => { setWalletChain(undefined); query.refetch(); }} />}
      <Modal
        open={Boolean(pauseTarget)}
        title={t(pauseTarget?.withdrawalPaused ? 'Resume withdrawals' : 'Emergency pause')}
        okText={t(pauseTarget?.withdrawalPaused ? 'Resume withdrawals' : 'Emergency pause')}
        okButtonProps={{ danger: !pauseTarget?.withdrawalPaused, loading: saving?.startsWith('pause:') }}
        onOk={() => pauseForm.submit()}
        onCancel={() => { setPauseTarget(undefined); pauseForm.resetFields(); }}
      >
        {!pauseTarget?.withdrawalPaused && <Alert showIcon type="warning"
          title={t('New withdrawal signing will stop. Already signed or broadcast transfers may still complete; check their status and reconcile balances.')} />}
        <Form form={pauseForm} name="chain-withdrawal-pause" layout="vertical" onFinish={changeWithdrawalPause}>
          <Form.Item name="reason" label={t('Reason')}
            rules={[{ required: true, whitespace: true, min: 8, max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
