import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { hasRole, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import { formatDate, queryString } from '../utils/format';

type Endpoint = {
  id: string;
  name: string;
  url: string;
  status: string;
  verifiedAt?: string;
  lastDeliveryAt?: string;
  successRate24h?: number;
};

type Delivery = {
  id: string;
  eventId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  totalAttemptCount: number;
  manualRetryCount: number;
  nextAttemptAt?: string;
  nextAttemptTrigger?: string;
  lastHttpStatus?: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
};

type DeliveryAttempt = {
  id: string;
  attemptNumber: number;
  retryCycle: number;
  trigger: 'AUTOMATIC' | 'MANUAL' | 'RECOVERY';
  status: string;
  httpStatus?: number;
  errorMessage?: string;
  responseBody?: string;
  nextAttemptAt?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
};

type CreatedEndpoint = Endpoint & { signingSecret: string };
type EndpointForm = { name: string; url: string };
type DeliveryStatus = '' | 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'RETRY' | 'FAILED';

export default function WebhookAccessSection() {
  const session = useSession();
  const canManage = hasRole(session, 'TENANT_ADMIN');
  const { message } = App.useApp();
  const { t } = useI18n();
  const [form] = Form.useForm<EndpointForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedEndpoint>();
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<Endpoint>();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery>();
  const [retryingId, setRetryingId] = useState<string>();
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('');
  const [retryingFailed, setRetryingFailed] = useState(false);

  const endpoints = useApiQuery<Endpoint[]>(
    (signal) => session
      ? api.get('/custody/console/v1/webhooks', signal)
      : Promise.resolve([]),
    [session?.userId],
  );
  const deliveries = useApiQuery<Delivery[]>(
    (signal) => session && deliveryEndpoint
      ? api.get(
          `/custody/console/v1/webhook-deliveries${queryString({
            endpointId: deliveryEndpoint.id,
            status: deliveryStatus,
            limit: 100,
          })}`,
          signal,
        )
      : Promise.resolve([]),
    [session?.userId, deliveryEndpoint?.id, deliveryStatus],
  );
  const attempts = useApiQuery<DeliveryAttempt[]>(
    (signal) => session && selectedDelivery
      ? api.get(
          `/custody/console/v1/webhook-deliveries/${selectedDelivery.id}/attempts?limit=100`,
          signal,
        )
      : Promise.resolve([]),
    [session?.userId, selectedDelivery?.id],
  );

  const create = async (values: EndpointForm) => {
    if (!session) return;
    setCreating(true);
    try {
      const result = await api.post<CreatedEndpoint>(
        '/custody/console/v1/webhooks',
        values,
      );
      setCreateOpen(false);
      setCreated(result);
      form.resetFields();
      endpoints.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to create endpoint'));
    } finally {
      setCreating(false);
    }
  };

  const verify = async (endpoint: Endpoint) => {
    if (!session) return;
    try {
      await api.post(`/custody/console/v1/webhooks/${endpoint.id}/verify`);
      await message.success(t('Endpoint verified and activated'));
      endpoints.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Verification failed'));
    }
  };

  const setEnabled = async (endpoint: Endpoint, enabled: boolean) => {
    if (!session) return;
    try {
      await api.patch(`/custody/console/v1/webhooks/${endpoint.id}/status`, {
        enabled,
      });
      endpoints.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to change endpoint'));
    }
  };

  const retry = async (delivery: Delivery) => {
    if (!session) return;
    setRetryingId(delivery.id);
    try {
      await api.post(
        `/custody/console/v1/webhook-deliveries/${delivery.id}/retry`,
      );
      await message.success(t('Delivery queued for retry'));
      deliveries.refetch();
      attempts.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to retry delivery'));
    } finally {
      setRetryingId(undefined);
    }
  };

  const retryAllFailed = async () => {
    if (!session || !deliveryEndpoint) return;
    setRetryingFailed(true);
    try {
      const result = await api.post<{ queued: number }>(
        `/custody/console/v1/webhook-deliveries/retry-failed${queryString({
          endpointId: deliveryEndpoint.id,
        })}`,
      );
      await message.success(t('{count} deliveries queued for retry', { count: result.queued }));
      deliveries.refetch();
      attempts.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to retry failed deliveries'));
    } finally {
      setRetryingFailed(false);
    }
  };

  return (
    <>
      <section className="data-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('Webhook endpoints')}</h2>
            <p>{t('API-created address events are delivered automatically to every active endpoint.')}</p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={endpoints.refetch}>{t('Reload')}</Button>
            {canManage ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                {t('Add endpoint')}
              </Button>
            ) : null}
          </Space>
        </div>
        <Alert
          showIcon
          type="info"
          title={t('No event subscription is required')}
          description={t('Confirmed deposits and every withdrawal state event for addresses created through the API are sent automatically. Console-created address events are not sent to tenant business systems.')}
        />
        <ErrorState message={endpoints.error} onRetry={endpoints.refetch} />
        <Table<Endpoint>
          rowKey="id"
          loading={endpoints.loading}
          dataSource={endpoints.data ?? []}
          locale={{ emptyText: <Empty description={t('No webhook endpoint configured')} /> }}
          scroll={{ x: 1080 }}
          columns={[
            {
              title: t('Endpoint'),
              render: (_, row) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{row.name}</Typography.Text>
                  <Typography.Text type="secondary">{row.url}</Typography.Text>
                </Space>
              ),
            },
            { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: t('Success (24h)'),
              dataIndex: 'successRate24h',
              render: (value?: number) => value === null || value === undefined ? '—' : `${value.toFixed(1)}%`,
            },
            { title: t('Last delivery'), dataIndex: 'lastDeliveryAt', render: formatDate },
            {
              title: t('Enabled'),
              render: (_, row) => (
                <Switch
                  checked={row.status === 'ACTIVE'}
                  disabled={!canManage || row.status === 'PENDING_VERIFICATION'}
                  onChange={(checked) => void setEnabled(row, checked)}
                />
              ),
            },
            {
              title: t('Actions'),
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  {canManage && row.status === 'PENDING_VERIFICATION' ? (
                    <Button icon={<CheckCircleOutlined />} onClick={() => void verify(row)}>
                      {t('Verify')}
                    </Button>
                  ) : null}
                  <Button onClick={() => {
                    setDeliveryStatus('');
                    setDeliveryEndpoint(row);
                  }}>{t('Deliveries')}</Button>
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={t('Add webhook endpoint')}
        open={createOpen}
        confirmLoading={creating}
        okText={t('Create endpoint')}
        onOk={() => form.submit()}
        onCancel={() => setCreateOpen(false)}
      >
        <Form<EndpointForm> form={form} layout="vertical" requiredMark={false} onFinish={create}>
          <Form.Item name="name" label={t('Name')} rules={[{ required: true }]}>
            <Input placeholder={t('Production custody events')} />
          </Form.Item>
          <Form.Item
            name="url"
            label={t('Endpoint URL')}
            rules={[
              { required: true },
              { type: 'url', message: t('Enter a valid HTTPS URL') },
            ]}
          >
            <Input placeholder="https://api.example.com/webhooks/custody" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('Webhook signing secret')}
        open={Boolean(created)}
        footer={
          <Button
            type="primary"
            onClick={() => {
              setCreated(undefined);
            }}
          >
            {t('I saved the secret')}
          </Button>
        }
        closable={false}
        mask={{ closable: false }}
      >
        <p className="one-time-note">
          {t('Copy this secret now. It will not be shown again.')}
        </p>
        <Input
          readOnly
          value={created?.signingSecret}
          addonAfter={
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => {
                if (created) void navigator.clipboard.writeText(created.signingSecret);
              }}
            />
          }
        />
      </Modal>

      <Drawer
        title={deliveryEndpoint ? t('{name} deliveries', { name: deliveryEndpoint.name }) : t('Deliveries')}
        size={760}
        open={Boolean(deliveryEndpoint)}
        onClose={() => {
          setDeliveryEndpoint(undefined);
          setDeliveryStatus('');
        }}
      >
        <Alert
          showIcon
          type="info"
          title={t('Automatic retry policy')}
          description={t('Failed deliveries retry up to 10 times with exponential backoff, deterministic jitter, and Retry-After support. Every attempt is retained; a manual retry starts a new cycle without erasing history.')}
        />
        <ErrorState message={deliveries.error} onRetry={deliveries.refetch} />
        <div className="drawer-toolbar">
          <Space wrap>
            <Select<DeliveryStatus>
              aria-label={t('Delivery status')}
              value={deliveryStatus}
              style={{ width: 190 }}
              onChange={setDeliveryStatus}
              options={[
                { value: '', label: t('All delivery statuses') },
                { value: 'FAILED', label: t('Failed') },
                { value: 'RETRY', label: t('Retry scheduled') },
                { value: 'PENDING', label: t('Pending') },
                { value: 'DELIVERING', label: t('Delivering') },
                { value: 'DELIVERED', label: t('Delivered') },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={deliveries.refetch}>{t('Reload deliveries')}</Button>
            {canManage ? (
              <Popconfirm
                title={t('Retry all failed deliveries for this endpoint?')}
                description={t('Every FAILED or RETRY delivery will start a new manual retry cycle. Successful deliveries are never replayed.')}
                onConfirm={() => void retryAllFailed()}
              >
                <Button danger icon={<RetweetOutlined />} loading={retryingFailed}>
                  {t('Retry all failed')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        </div>
        <Table<Delivery>
          rowKey="id"
          size="small"
          loading={deliveries.loading}
          dataSource={deliveries.data ?? []}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description={t('No delivery attempts yet')} /> }}
          columns={[
            { title: t('Event'), dataIndex: 'eventType' },
            { title: t('Event ID'), dataIndex: 'eventId', render: (value) => <CopyText value={value} /> },
            { title: 'HTTP', dataIndex: 'lastHttpStatus', render: (value) => value ?? '—' },
            { title: t('Attempts'), dataIndex: 'totalAttemptCount' },
            { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: t('Next attempt'),
              dataIndex: 'nextAttemptAt',
              render: (value: string | undefined, row) =>
                row.status === 'RETRY' ? formatDate(value) : '—',
            },
            {
              title: t('Last error'),
              dataIndex: 'lastError',
              ellipsis: true,
              render: (value?: string) => value || '—',
            },
            { title: t('Created'), dataIndex: 'createdAt', render: formatDate },
            {
              title: t('Actions'),
              render: (_, row) => (
                <Space>
                  <Button type="link" onClick={() => setSelectedDelivery(row)}>
                    {t('Details')}
                  </Button>
                  {canManage && (row.status === 'FAILED' || row.status === 'RETRY') ? (
                    <Popconfirm
                      title={t('Queue this delivery now?')}
                      description={t('This starts a new manual retry cycle and keeps all previous attempts.')}
                      onConfirm={() => void retry(row)}
                    >
                      <Button
                        type="text"
                        icon={<RetweetOutlined />}
                        loading={retryingId === row.id}
                      >
                        {t('Retry now')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Drawer>

      <Modal
        title={t('Webhook delivery details')}
        width={900}
        open={Boolean(selectedDelivery)}
        footer={<Button onClick={() => setSelectedDelivery(undefined)}>{t('Close')}</Button>}
        onCancel={() => setSelectedDelivery(undefined)}
      >
        {selectedDelivery ? (
          <div className="delivery-details">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('Event')}>{selectedDelivery.eventType}</Descriptions.Item>
              <Descriptions.Item label={t('Status')}>
                <StatusText value={selectedDelivery.status} />
              </Descriptions.Item>
              <Descriptions.Item label={t('Event ID')} span={2}>
                <CopyText value={selectedDelivery.eventId} />
              </Descriptions.Item>
              <Descriptions.Item label={t('Total attempts')}>
                {selectedDelivery.totalAttemptCount}
              </Descriptions.Item>
              <Descriptions.Item label={t('Manual retry cycles')}>
                {selectedDelivery.manualRetryCount}
              </Descriptions.Item>
              <Descriptions.Item label={t('Next automatic attempt')}>
                {selectedDelivery.status === 'RETRY'
                  ? formatDate(selectedDelivery.nextAttemptAt)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('Last HTTP status')}>
                {selectedDelivery.lastHttpStatus ?? '—'}
              </Descriptions.Item>
              {selectedDelivery.lastError ? (
                <Descriptions.Item label={t('Last error')} span={2}>
                  <Typography.Text type="danger">
                    {selectedDelivery.lastError}
                  </Typography.Text>
                </Descriptions.Item>
              ) : null}
            </Descriptions>
            <div className="panel-heading delivery-attempt-heading">
              <div>
                <h3>{t('Attempt history')}</h3>
                <p>{t('Newest attempt first. Recovery means a worker lease expired and was safely reclaimed.')}</p>
              </div>
              <Button icon={<ReloadOutlined />} onClick={attempts.refetch}>{t('Reload')}</Button>
            </div>
            <ErrorState message={attempts.error} onRetry={attempts.refetch} />
            <Table<DeliveryAttempt>
              rowKey="id"
              size="small"
              loading={attempts.loading}
              dataSource={attempts.data ?? []}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description={t('No dispatch attempt has started yet')} /> }}
              scroll={{ x: 820 }}
              columns={[
                { title: '#', dataIndex: 'attemptNumber', width: 54 },
                { title: t('Trigger'), dataIndex: 'trigger' },
                { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
                { title: 'HTTP', dataIndex: 'httpStatus', render: (value) => value ?? '—' },
                {
                  title: t('Duration'),
                  dataIndex: 'durationMs',
                  render: (value?: number) => value === undefined || value === null ? '—' : `${value} ms`,
                },
                { title: t('Started'), dataIndex: 'startedAt', render: formatDate },
                {
                  title: t('Result'),
                  render: (_, row) => row.errorMessage || row.responseBody || '—',
                  ellipsis: true,
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
