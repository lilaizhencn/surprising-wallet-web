import { useState } from 'react';
import {
  App,
  Button,
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
  lastHttpStatus?: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
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
  const [form] = Form.useForm<EndpointForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedEndpoint>();
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<Endpoint>();

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
      void message.error(error instanceof Error ? error.message : 'Unable to create endpoint');
    } finally {
      setCreating(false);
    }
  };

  const verify = async (endpoint: Endpoint) => {
    if (!session) return;
    try {
      await api.post(`/custody/console/v1/webhooks/${endpoint.id}/verify`, session.token);
      await message.success('Endpoint verified and activated');
      endpoints.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Verification failed');
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
      void message.error(error instanceof Error ? error.message : 'Unable to change endpoint');
    }
  };

  const retry = async (delivery: Delivery) => {
    if (!session) return;
    try {
      await api.post(
        `/custody/console/v1/webhook-deliveries/${delivery.id}/retry`,
        session.token,
      );
      await message.success('Delivery queued for retry');
      deliveries.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to retry delivery');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Webhooks"
        description="Verify endpoints, subscribe to custody events, and inspect every delivery attempt."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add endpoint
          </Button>
        }
      />
      <ErrorState message={endpoints.error} onRetry={endpoints.refetch} />
      <section className="data-panel">
        <div className="panel-heading">
          <h2>Endpoints</h2>
          <Button icon={<ReloadOutlined />} onClick={endpoints.refetch}>Reload</Button>
        </div>
        <Table<Endpoint>
          rowKey="id"
          loading={endpoints.loading}
          dataSource={endpoints.data ?? []}
          locale={{ emptyText: <Empty description="No webhook endpoint configured" /> }}
          scroll={{ x: 1080 }}
          columns={[
            {
              title: 'Endpoint',
              render: (_, row) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{row.name}</Typography.Text>
                  <Typography.Text type="secondary">{row.url}</Typography.Text>
                </Space>
              ),
            },
            {
              title: 'Events',
              dataIndex: 'events',
              render: (values: string[]) => `${values.length} subscribed`,
            },
            { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: 'Success (24h)',
              dataIndex: 'successRate24h',
              render: (value?: number) => value === null || value === undefined ? '—' : `${value.toFixed(1)}%`,
            },
            { title: 'Last delivery', dataIndex: 'lastDeliveryAt', render: formatDate },
            {
              title: 'Enabled',
              render: (_, row) => (
                <Switch
                  checked={row.status === 'ACTIVE'}
                  disabled={row.status === 'PENDING_VERIFICATION'}
                  onChange={(checked) => void setEnabled(row, checked)}
                />
              ),
            },
            {
              title: 'Actions',
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  {row.status === 'PENDING_VERIFICATION' ? (
                    <Button icon={<CheckCircleOutlined />} onClick={() => void verify(row)}>
                      Verify
                    </Button>
                  ) : null}
                  <Button onClick={() => setDeliveryEndpoint(row)}>Deliveries</Button>
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title="Add webhook endpoint"
        open={createOpen}
        confirmLoading={creating}
        okText="Create endpoint"
        onOk={() => form.submit()}
        onCancel={() => setCreateOpen(false)}
      >
        <Form<EndpointForm> form={form} layout="vertical" requiredMark={false} onFinish={create}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Production custody events" />
          </Form.Item>
          <Form.Item
            name="url"
            label="Endpoint URL"
            rules={[
              { required: true },
              { type: 'url', message: 'Enter a valid HTTPS URL' },
            ]}
          >
            <Input placeholder="https://api.example.com/webhooks/custody" />
          </Form.Item>
          <Form.Item name="events" label="Subscribed events" rules={[{ required: true }]}>
            <Select mode="multiple" options={eventOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Webhook signing secret"
        open={Boolean(created)}
        footer={
          <Button
            type="primary"
            onClick={() => {
              setCreated(undefined);
            }}
          >
            I saved the secret
          </Button>
        }
        closable={false}
        mask={{ closable: false }}
      >
        <p className="one-time-note">
          Copy this secret now. It will not be shown again.
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
        title={deliveryEndpoint ? `${deliveryEndpoint.name} deliveries` : 'Deliveries'}
        size={760}
        open={Boolean(deliveryEndpoint)}
        onClose={() => setDeliveryEndpoint(undefined)}
      >
        <ErrorState message={deliveries.error} onRetry={deliveries.refetch} />
        <Table<Delivery>
          rowKey="id"
          size="small"
          loading={deliveries.loading}
          dataSource={deliveries.data ?? []}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="No delivery attempts yet" /> }}
          columns={[
            { title: 'Event', dataIndex: 'eventType' },
            { title: 'Event ID', dataIndex: 'eventId', render: (value) => <CopyText value={value} /> },
            { title: 'HTTP', dataIndex: 'lastHttpStatus', render: (value) => value ?? '—' },
            { title: 'Attempts', dataIndex: 'attemptCount' },
            { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            {
              title: 'Last error',
              dataIndex: 'lastError',
              ellipsis: true,
              render: (value?: string) => value || '—',
            },
            { title: 'Created', dataIndex: 'createdAt', render: formatDate },
            {
              title: '',
              render: (_, row) => row.status === 'FAILED' || row.status === 'RETRY' ? (
                <Popconfirm title="Queue this delivery again?" onConfirm={() => void retry(row)}>
                  <Button type="text" icon={<RetweetOutlined />} aria-label="Retry delivery" />
                </Popconfirm>
              ) : null,
            },
          ]}
        />
      </Drawer>
    </div>
  );
}
