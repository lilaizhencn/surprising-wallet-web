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
import { useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { useI18n } from '../i18n';
import { formatDate, queryString } from '../utils/format';

type Endpoint = {
  id: string;
  name: string;
  url: string;
  events: string[];
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
type EndpointForm = { name: string; url: string; events: string[] };

const eventOptions = [
  'DEPOSIT.CONFIRMED',
  'WITHDRAWAL.CREATED',
  'WITHDRAWAL.BROADCAST',
  'WITHDRAWAL.BROADCAST_UNKNOWN',
  'WITHDRAWAL.CONFIRMED',
  'WITHDRAWAL.FAILED',
].map((value) => ({ value, label: value }));

export default function WebhooksPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [form] = Form.useForm<EndpointForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedEndpoint>();
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<Endpoint>();
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery>();
  const [retryingId, setRetryingId] = useState<string>();

  const endpoints = useApiQuery<Endpoint[]>(
    (signal) => session
      ? api.get('/custody/console/v1/webhooks', session.token, signal)
      : Promise.resolve([]),
    [session?.token],
  );
  const deliveries = useApiQuery<Delivery[]>(
    (signal) => session && deliveryEndpoint
      ? api.get(
          `/custody/console/v1/webhook-deliveries${queryString({
            endpointId: deliveryEndpoint.id,
            limit: 100,
          })}`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, deliveryEndpoint?.id],
  );
  const attempts = useApiQuery<DeliveryAttempt[]>(
    (signal) => session && selectedDelivery
      ? api.get(
          `/custody/console/v1/webhook-deliveries/${selectedDelivery.id}/attempts?limit=100`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, selectedDelivery?.id],
  );

  const create = async (values: EndpointForm) => {
    if (!session) return;
    setCreating(true);
    try {
      const result = await api.post<CreatedEndpoint>(
        '/custody/console/v1/webhooks',
        session.token,
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
      await api.post(`/custody/console/v1/webhooks/${endpoint.id}/verify`, session.token);
      await message.success(t('Endpoint verified and activated'));
      endpoints.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Verification failed'));
    }
  };

  const setEnabled = async (endpoint: Endpoint, enabled: boolean) => {
    if (!session) return;
    try {
      await api.patch(`/custody/console/v1/webhooks/${endpoint.id}/status`, session.token, {
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
        session.token,
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

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Webhooks')}
        description={t('Verify endpoints, subscribe to custody events, and inspect every delivery attempt.')}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('Add endpoint')}
          </Button>
        }
      />
      <ErrorState message={endpoints.error} onRetry={endpoints.refetch} />
      <section className="data-panel">
        <div className="panel-heading">
          <h2>{t('Endpoints')}</h2>
          <Button icon={<ReloadOutlined />} onClick={endpoints.refetch}>{t('Reload')}</Button>
        </div>
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
            {
              title: t('Events'),
              dataIndex: 'events',
              render: (values: string[]) => t('{count} subscribed', { count: values.length }),
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
                  disabled={row.status === 'PENDING_VERIFICATION'}
                  onChange={(checked) => void setEnabled(row, checked)}
                />
              ),
            },
            {
              title: t('Actions'),
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  {row.status === 'PENDING_VERIFICATION' ? (
                    <Button icon={<CheckCircleOutlined />} onClick={() => void verify(row)}>
                      {t('Verify')}
                    </Button>
                  ) : null}
                  <Button onClick={() => setDeliveryEndpoint(row)}>{t('Deliveries')}</Button>
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
          <Form.Item name="events" label={t('Subscribed events')} rules={[{ required: true }]}>
            <Select mode="multiple" options={eventOptions} />
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
        onClose={() => setDeliveryEndpoint(undefined)}
      >
        <Alert
          showIcon
          type="info"
          title={t('Automatic retry policy')}
          description={t('Failed deliveries retry up to 10 times with exponential backoff, deterministic jitter, and Retry-After support. Every attempt is retained; a manual retry starts a new cycle without erasing history.')}
        />
        <ErrorState message={deliveries.error} onRetry={deliveries.refetch} />
        <div className="drawer-toolbar">
          <Button icon={<ReloadOutlined />} onClick={deliveries.refetch}>{t('Reload deliveries')}</Button>
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
                  {row.status === 'FAILED' || row.status === 'RETRY' ? (
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
    </div>
  );
}
