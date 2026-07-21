import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import type {
  TenantAddress,
  TenantAdministrator,
  TenantApiKey,
  TenantAsset,
  TenantAuditEntry,
  TenantDeposit,
  TenantDetail,
  TenantGasAccount,
  TenantIpRule,
  TenantWebhook,
  TenantWebhookDelivery,
  TenantWithdrawal,
} from '../types/platform';
import { formatAmount, formatDate } from '../utils/format';
import { useI18n } from '../i18n';

type EditTenantForm = {
  name: string;
  displayCurrency: string;
};

const emptyValue = (value?: string | null) => value || '—';

const assetColumns: TableColumnsType<TenantAsset> = [
  { title: 'Asset', dataIndex: 'assetSymbol' },
  { title: 'Chain', dataIndex: 'chain' },
  {
    title: 'Available',
    dataIndex: 'availableBalance',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  {
    title: 'Locked',
    dataIndex: 'lockedBalance',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  {
    title: 'Total',
    dataIndex: 'totalBalance',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  { title: 'Addresses', dataIndex: 'addressCount', align: 'right' },
];

const addressColumns: TableColumnsType<TenantAddress> = [
  {
    title: 'Address',
    dataIndex: 'address',
    render: (value: string) => (
      <Typography.Text className="mono-cell" copyable={{ text: value }} ellipsis>
        {value}
      </Typography.Text>
    ),
  },
  { title: 'Chain', dataIndex: 'chain' },
  { title: 'Subject', dataIndex: 'subject', render: emptyValue },
  { title: 'Address version', dataIndex: 'addressVersion' },
  { title: 'Label', dataIndex: 'label', render: emptyValue },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

const gasColumns: TableColumnsType<TenantGasAccount> = [
  {
    title: 'Reserve',
    render: (_, row) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{row.chain}</Typography.Text>
        <Typography.Text type="secondary">{row.network}</Typography.Text>
      </Space>
    ),
  },
  {
    title: 'Available',
    render: (_, row) => (
      <Typography.Text
        type={
          Number(row.availableBalance) < Number(row.lowBalanceThreshold)
            ? 'danger'
            : undefined
        }
      >
        {formatAmount(row.availableBalance)} {row.nativeSymbol}
      </Typography.Text>
    ),
  },
  {
    title: 'Locked',
    render: (_, row) => `${formatAmount(row.lockedBalance)} ${row.nativeSymbol}`,
  },
  {
    title: 'Low-balance threshold',
    render: (_, row) => `${formatAmount(row.lowBalanceThreshold)} ${row.nativeSymbol}`,
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
];

const apiKeyColumns: TableColumnsType<TenantApiKey> = [
  {
    title: 'Key',
    render: (_, row) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{row.name}</Typography.Text>
        <Typography.Text className="mono-cell" copyable={{ text: row.keyId }}>
          {row.keyId}
        </Typography.Text>
      </Space>
    ),
  },
  {
    title: 'Scopes',
    dataIndex: 'scopes',
    render: (scopes: string[]) => (
      <Space size={[4, 4]} wrap>
        {scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)}
      </Space>
    ),
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Last used', dataIndex: 'lastUsedAt', render: formatDate },
  { title: 'Last IP', dataIndex: 'lastUsedIp', render: emptyValue },
];

const ipRuleColumns: TableColumnsType<TenantIpRule> = [
  { title: 'Label', dataIndex: 'label' },
  { title: 'CIDR', dataIndex: 'cidr', render: (value) => <Typography.Text code>{value}</Typography.Text> },
  {
    title: 'Enforced rule',
    dataIndex: 'enabled',
    render: (value: boolean) => <StatusText value={value ? 'ACTIVE' : 'DISABLED'} />,
  },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

const webhookColumns: TableColumnsType<TenantWebhook> = [
  {
    title: 'Endpoint',
    render: (_, row) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{row.name}</Typography.Text>
        <Typography.Text className="endpoint-cell" copyable={{ text: row.url }} ellipsis>
          {row.url}
        </Typography.Text>
      </Space>
    ),
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Deliveries (24h)', dataIndex: 'deliveryCount24h', align: 'right' },
  {
    title: 'Success (24h)',
    dataIndex: 'successRate24h',
    align: 'right',
    render: (value?: number | null) => value === null || value === undefined
      ? '—'
      : `${value.toFixed(1)}%`,
  },
  { title: 'Last delivery', dataIndex: 'lastDeliveryAt', render: formatDate },
];

const deliveryColumns: TableColumnsType<TenantWebhookDelivery> = [
  { title: 'Event', dataIndex: 'eventType' },
  {
    title: 'Aggregate',
    render: (_, row) => `${row.aggregateType} · ${row.aggregateId}`,
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Attempts', dataIndex: 'totalAttemptCount', align: 'right' },
  { title: 'Manual retries', dataIndex: 'manualRetryCount', align: 'right' },
  { title: 'HTTP', dataIndex: 'lastHttpStatus', render: emptyValue },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

const depositColumns: TableColumnsType<TenantDeposit> = [
  {
    title: 'Deposit',
    render: (_, row) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{row.subject || '—'}</Typography.Text>
        <Typography.Text className="mono-cell" copyable={{ text: row.txHash }} ellipsis>
          {row.txHash}
        </Typography.Text>
      </Space>
    ),
  },
  { title: 'Chain', dataIndex: 'chain' },
  { title: 'Asset', dataIndex: 'assetSymbol' },
  {
    title: 'Amount',
    dataIndex: 'amount',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

const withdrawalColumns: TableColumnsType<TenantWithdrawal> = [
  {
    title: 'Withdrawal',
    render: (_, row) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text strong>{row.externalReference || row.orderNo}</Typography.Text>
        <Typography.Text type="secondary">{row.orderNo}</Typography.Text>
      </Space>
    ),
  },
  { title: 'Chain', dataIndex: 'chain' },
  { title: 'Asset', dataIndex: 'assetSymbol' },
  {
    title: 'Amount',
    dataIndex: 'amount',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  {
    title: 'Network fee',
    dataIndex: 'fee',
    align: 'right',
    render: (value) => formatAmount(value),
  },
  { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

const auditColumns: TableColumnsType<TenantAuditEntry> = [
  { title: 'Action', dataIndex: 'action' },
  { title: 'Actor', dataIndex: 'actorType' },
  {
    title: 'Resource',
    render: (_, row) => `${row.resourceType}${row.resourceId ? ` · ${row.resourceId}` : ''}`,
  },
  { title: 'Source IP', dataIndex: 'sourceIp', render: emptyValue },
  { title: 'Created', dataIndex: 'createdAt', render: formatDate },
];

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="data-panel tenant-detail-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function translateColumns<T>(
  columns: TableColumnsType<T>,
  t: (message: string, values?: Record<string, string | number>) => string,
): TableColumnsType<T> {
  return columns.map((column) => ({
    ...column,
    title: typeof column.title === 'string' ? t(column.title) : column.title,
  }));
}

export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [editValues, setEditValues] = useState<EditTenantForm>({
    name: '',
    displayCurrency: 'USD',
  });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string>();

  const query = useApiQuery<TenantDetail>(
    (signal) => session && tenantId
      ? api.get(`/custody/platform/v1/tenants/${tenantId}`, signal)
      : Promise.reject(new Error(t('Tenant identifier is missing'))),
    [session?.userId, tenantId, t],
  );

  useEffect(() => {
    if (query.data?.tenant) {
      setEditValues({
        name: query.data.tenant.name,
        displayCurrency: query.data.tenant.displayCurrency,
      });
    }
  }, [query.data?.tenant.id, query.data?.tenant.updatedAt]);

  const unlockAdministrator = useCallback(async (administrator: TenantAdministrator) => {
    if (!session || !tenantId) return;
    setUnlockingId(administrator.id);
    try {
      await api.post(
        `/custody/platform/v1/tenants/${tenantId}/administrators/${administrator.id}/unlock`,
      );
      await message.success(t('Tenant administrator unlocked'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to unlock administrator'));
    } finally {
      setUnlockingId(undefined);
    }
  }, [message, query.refetch, session, t, tenantId]);

  const administratorColumns = useMemo<TableColumnsType<TenantAdministrator>>(
    () => [
      {
        title: t('Administrator'),
        render: (_, row) => (
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{row.displayName}</Typography.Text>
            <Typography.Text type="secondary">{row.email}</Typography.Text>
          </Space>
        ),
      },
      { title: t('Role'), dataIndex: 'role' },
      { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
      { title: t('Failed logins'), dataIndex: 'failedLoginCount', align: 'right' },
      {
        title: t('Locked until'),
        dataIndex: 'lockedUntil',
        render: formatDate,
      },
      { title: t('Last login'), dataIndex: 'lastLoginAt', render: formatDate },
      {
        title: '',
        width: 100,
        render: (_, row) => {
          const locked = Boolean(
            row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now(),
          );
          return locked ? (
            <Popconfirm
              title={t('Unlock this tenant administrator?')}
              description={t('Failed-login counters and the temporary login lock will be cleared.')}
              onConfirm={() => void unlockAdministrator(row)}
            >
              <Button
                size="small"
                icon={<LockOutlined />}
                loading={unlockingId === row.id}
              >
                {t('Unlock')}
              </Button>
            </Popconfirm>
          ) : null;
        },
      },
    ],
    [t, unlockAdministrator, unlockingId],
  );

  const saveTenant = async () => {
    if (!session || !tenantId) return;
    const values = {
      name: editValues.name.trim(),
      displayCurrency: editValues.displayCurrency.trim().toUpperCase(),
    };
    if (!values.name || values.name.length > 160) {
      void message.error(t('Tenant name is required and must not exceed 160 characters'));
      return;
    }
    if (!/^[A-Z0-9]{3,12}$/.test(values.displayCurrency)) {
      void message.error(t('Display currency must contain 3-12 uppercase letters or digits'));
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/custody/platform/v1/tenants/${tenantId}`, values);
      await message.success(t('Tenant details updated'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update tenant'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    const tenant = query.data?.tenant;
    if (!session || !tenantId || !tenant) return;
    const status = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setStatusSaving(true);
    try {
      await api.patch(
        `/custody/platform/v1/tenants/${tenantId}/status`,
        { status },
      );
      await message.success(t(status === 'ACTIVE' ? 'Tenant activated' : 'Tenant suspended'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to change tenant status'));
    } finally {
      setStatusSaving(false);
    }
  };

  const tenant = query.data?.tenant;
  const data = query.data;

  if (!tenant || !data) {
    return (
      <div className="page-stack">
        <PageHeader
          title={t('Tenant details')}
          description={t('Loading the platform operations view.')}
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/tenants')}>
              {t('Back to tenants')}
            </Button>
          }
        />
        <ErrorState message={query.error} onRetry={query.refetch} />
        {query.loading ? <section className="data-panel"><Skeleton active /></section> : null}
      </div>
    );
  }

  const onboardingItems = [
    ['API request key', data.onboarding.apiKeyConfigured],
    ['Verified Webhook', data.onboarding.webhookConfigured],
    ['IP allowlist enforcement', data.onboarding.ipAllowlistConfigured],
    ['Customer address', data.onboarding.addressCreated],
    ['Gas reserve account', data.onboarding.gasAccountConfigured],
    ['Funded Gas reserve', data.onboarding.gasAccountFunded],
  ] as const;

  const overview = (
    <div className="page-stack">
      <div className="tenant-metric-grid">
        <div className="metric-card">
          <Statistic title={t('Customer assets')} value={data.assets.length} />
        </div>
        <div className="metric-card">
          <Statistic title={t('Customer addresses')} value={data.statistics.addressCount} />
        </div>
        <div className="metric-card">
          <Statistic title={t('Withdrawals')} value={data.statistics.withdrawalCount} />
        </div>
        <div className="metric-card">
          <Statistic
            title={t('Webhook failures')}
            value={data.statistics.failedWebhookDeliveryCount}
            styles={{
              content: data.statistics.failedWebhookDeliveryCount > 0
                ? { color: '#b42318' }
                : {},
            }}
          />
        </div>
        <div className="metric-card">
          <Statistic title={t('Active sessions')} value={data.statistics.activeSessionCount} />
        </div>
        <div className="metric-card">
          <Statistic
            title={t('Onboarding')}
            value={data.onboarding.completedSteps}
            suffix={`/ ${data.onboarding.totalSteps}`}
          />
        </div>
      </div>

      <div className="tenant-detail-grid">
        <DetailSection title={t('Tenant settings')}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('Tenant ID')}>
              <Typography.Text copyable>{tenant.id}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('Slug')}>
              <Typography.Text copyable>{tenant.slug}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('Status')}><StatusText value={tenant.status} /></Descriptions.Item>
            <Descriptions.Item label={t('Derivation namespace')}>
              {tenant.derivationNamespace}
            </Descriptions.Item>
            <Descriptions.Item label={t('Display currency')}>
              {tenant.displayCurrency}
            </Descriptions.Item>
            <Descriptions.Item label={t('IP allowlist')}>
              {t(tenant.ipAllowlistEnabled ? 'Enforced' : 'Not enforced')}
            </Descriptions.Item>
            <Descriptions.Item label={t('Created')}>{formatDate(tenant.createdAt)}</Descriptions.Item>
            <Descriptions.Item label={t('Updated')}>{formatDate(tenant.updatedAt)}</Descriptions.Item>
          </Descriptions>
          <form
            aria-label={t('Edit tenant details')}
            className="tenant-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTenant();
            }}
          >
            <label>
              <span>{t('Tenant name')}</span>
              <Input
                aria-label={t('Tenant name')}
                maxLength={160}
                value={editValues.name}
                onChange={(event) => setEditValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))}
              />
            </label>
            <label>
              <span>{t('Display currency')}</span>
              <Input
                aria-label={t('Display currency')}
                maxLength={12}
                value={editValues.displayCurrency}
                onChange={(event) => setEditValues((current) => ({
                  ...current,
                  displayCurrency: event.target.value.toUpperCase(),
                }))}
              />
              <small>{t('Reporting label only; ledger balances are not converted.')}</small>
            </label>
            <div className="tenant-profile-actions">
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('Save changes')}
              </Button>
            </div>
          </form>
        </DetailSection>

        <DetailSection
          title={t('Integration readiness')}
          description={t('All six controls should be complete before production traffic.')}
        >
          <Progress
            percent={Math.round(
              (data.onboarding.completedSteps / data.onboarding.totalSteps) * 100,
            )}
            status={data.onboarding.ready ? 'success' : 'active'}
          />
          <div className="readiness-list">
            {onboardingItems.map(([label, complete]) => (
              <div key={label} className={complete ? 'complete' : 'incomplete'}>
                {complete ? <CheckCircleOutlined /> : <StopOutlined />}
                <span>{t(label)}</span>
                <StatusText value={complete ? 'READY' : 'SETUP_REQUIRED'} />
              </div>
            ))}
          </div>
        </DetailSection>
      </div>

      <DetailSection
        title={t('Tenant administrators')}
        description={t('Platform administrators can inspect lockouts without accessing tenant passwords.')}
      >
        <Table<TenantAdministrator>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.administrators}
          columns={administratorColumns}
          locale={{ emptyText: <Empty description={t('No tenant administrators')} /> }}
          scroll={{ x: 900 }}
        />
      </DetailSection>

      <DetailSection title={t('Customer asset balances')}>
        <Table<TenantAsset>
          rowKey={(row) => `${row.chain}:${row.assetSymbol}`}
          size="small"
          pagination={false}
          dataSource={data.assets}
          columns={translateColumns(assetColumns, t)}
          locale={{ emptyText: <Empty description={t('No funded customer assets')} /> }}
          scroll={{ x: 760 }}
        />
      </DetailSection>

      <DetailSection title={t('Gas reserves')}>
        <Table<TenantGasAccount>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.gasAccounts}
          columns={translateColumns(gasColumns, t)}
          locale={{ emptyText: <Empty description={t('No Gas reserve accounts')} /> }}
          scroll={{ x: 760 }}
        />
      </DetailSection>

      <DetailSection title={t('Recent customer addresses')}>
        <Table<TenantAddress>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.recentAddresses}
          columns={translateColumns(addressColumns, t)}
          locale={{ emptyText: <Empty description={t('No customer addresses')} /> }}
          scroll={{ x: 1000 }}
        />
      </DetailSection>
    </div>
  );

  const integration = (
    <div className="page-stack">
      <DetailSection title={t('API request keys')}>
        <Table<TenantApiKey>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.apiKeys}
          columns={translateColumns(apiKeyColumns, t)}
          locale={{ emptyText: <Empty description={t('No API request keys')} /> }}
          scroll={{ x: 980 }}
        />
      </DetailSection>
      <DetailSection
        title={t('IP allowlist')}
        description={t(tenant.ipAllowlistEnabled ? 'Enforcement is active.' : 'Enforcement is off.')}
      >
        <Table<TenantIpRule>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.ipRules}
          columns={translateColumns(ipRuleColumns, t)}
          locale={{ emptyText: <Empty description={t('No IP rules')} /> }}
          scroll={{ x: 700 }}
        />
      </DetailSection>
      <DetailSection title={t('Webhook endpoints')}>
        <Table<TenantWebhook>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.webhooks}
          columns={translateColumns(webhookColumns, t)}
          locale={{ emptyText: <Empty description={t('No Webhook endpoints')} /> }}
          scroll={{ x: 900 }}
        />
      </DetailSection>
      <DetailSection
        title={t('Recent Webhook deliveries')}
        description={t('Failures remain visible after automatic or manual retries.')}
      >
        <Table<TenantWebhookDelivery>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.webhookDeliveries}
          columns={translateColumns(deliveryColumns, t)}
          locale={{ emptyText: <Empty description={t('No Webhook deliveries')} /> }}
          scroll={{ x: 1050 }}
        />
      </DetailSection>
    </div>
  );

  const activity = (
    <div className="page-stack">
      <DetailSection title={t('Recent deposits')}>
        <Table<TenantDeposit>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.recentDeposits}
          columns={translateColumns(depositColumns, t)}
          locale={{ emptyText: <Empty description={t('No deposits')} /> }}
          scroll={{ x: 950 }}
        />
      </DetailSection>
      <DetailSection title={t('Recent withdrawals')}>
        <Table<TenantWithdrawal>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.recentWithdrawals}
          columns={translateColumns(withdrawalColumns, t)}
          locale={{ emptyText: <Empty description={t('No withdrawals')} /> }}
          scroll={{ x: 1000 }}
        />
      </DetailSection>
      <DetailSection title={t('Recent audit activity')}>
        <Table<TenantAuditEntry>
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          dataSource={data.recentAudit}
          columns={translateColumns(auditColumns, t)}
          locale={{ emptyText: <Empty description={t('No audit activity')} /> }}
          scroll={{ x: 950 }}
        />
      </DetailSection>
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader
        title={tenant.name}
        description={t('Platform operations view for {slug}', { slug: tenant.slug })}
        actions={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/tenants')}>
              {t('Back')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button>
            <Popconfirm
              title={t(tenant.status === 'ACTIVE' ? 'Suspend this tenant?' : 'Activate this tenant?')}
              description={
                tenant.status === 'ACTIVE'
                  ? t('API access stops immediately and all active tenant Console sessions are revoked.')
                  : t('Tenant credentials can authenticate again. Previously revoked sessions stay revoked.')
              }
              onConfirm={() => void changeStatus()}
            >
              <Button
                danger={tenant.status === 'ACTIVE'}
                type={tenant.status === 'SUSPENDED' ? 'primary' : 'default'}
                loading={statusSaving}
              >
                {t(tenant.status === 'ACTIVE' ? 'Suspend tenant' : 'Activate tenant')}
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      {tenant.status === 'SUSPENDED' ? (
        <Alert
          type="warning"
          showIcon
          title={t('Tenant access is suspended')}
          description={t('Console login and signed API requests are blocked until the platform reactivates this tenant.')}
        />
      ) : null}
      {!data.onboarding.ready ? (
        <Alert
          type="info"
          showIcon
          title={t('Integration setup is {completed}/{total}', { completed: data.onboarding.completedSteps, total: data.onboarding.totalSteps })}
          description={t('Review the Overview and Integration tabs to see the missing controls.')}
        />
      ) : null}
      {data.statistics.failedWebhookDeliveryCount > 0 ? (
        <Alert
          type="error"
          showIcon
          title={t('{count} failed Webhook deliveries', { count: data.statistics.failedWebhookDeliveryCount })}
          description={t('Open the Integration tab to review the latest delivery errors.')}
        />
      ) : null}

      <Tabs
        className="tenant-detail-tabs"
        items={[
          { key: 'overview', label: t('Overview'), children: overview },
          { key: 'integration', label: t('Integration'), children: integration },
          { key: 'activity', label: t('Activity & audit'), children: activity },
        ]}
      />

    </div>
  );
}
