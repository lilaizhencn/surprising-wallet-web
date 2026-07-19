import { useState } from 'react';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatDate } from '../utils/format';

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  derivationNamespace: number;
  ipAllowlistEnabled: boolean;
  displayCurrency: string;
  addressCount: number;
  depositCount: number;
  withdrawalCount: number;
  activeWebhookCount: number;
  createdAt: string;
  updatedAt: string;
};

type TenantForm = {
  slug: string;
  name: string;
  adminEmail: string;
  adminDisplayName: string;
  adminPassword: string;
};

export default function TenantsPage() {
  const session = useSession();
  const { message } = App.useApp();
  const [form] = Form.useForm<TenantForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Tenant>();
  const [saving, setSaving] = useState(false);

  const query = useApiQuery<Tenant[]>(
    (signal) => session
      ? api.get('/custody/platform/v1/tenants?limit=200', session.token, signal)
      : Promise.resolve([]),
    [session?.token],
  );

  const create = async (values: TenantForm) => {
    if (!session) return;
    setSaving(true);
    try {
      await api.post('/custody/platform/v1/tenants', session.token, values);
      await message.success('Tenant created');
      setCreateOpen(false);
      form.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (tenant: Tenant) => {
    if (!session) return;
    const status = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const updated = await api.patch<Tenant>(
        `/custody/platform/v1/tenants/${tenant.id}/status`,
        session.token,
        { status },
      );
      await message.success(`Tenant ${status === 'ACTIVE' ? 'activated' : 'suspended'}`);
      setSelected({ ...tenant, ...updated });
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to change tenant status');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Tenants"
        description="Create and control isolated custody customers without exposing seed material."
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create tenant
            </Button>
          </Space>
        }
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <Table<Tenant>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data ?? []}
          locale={{ emptyText: <Empty description="No tenants created" /> }}
          pagination={{ pageSize: 20 }}
          onRow={(row) => ({ onClick: () => setSelected(row) })}
          rowClassName="clickable-row"
          scroll={{ x: 1080 }}
          columns={[
            {
              title: 'Tenant',
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{row.name}</Typography.Text>
                  <Typography.Text type="secondary">{row.slug}</Typography.Text>
                </Space>
              ),
            },
            { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            { title: 'Namespace', dataIndex: 'derivationNamespace' },
            { title: 'Addresses', dataIndex: 'addressCount', align: 'right' },
            { title: 'Deposits', dataIndex: 'depositCount', align: 'right' },
            { title: 'Withdrawals', dataIndex: 'withdrawalCount', align: 'right' },
            { title: 'Active webhooks', dataIndex: 'activeWebhookCount', align: 'right' },
            { title: 'Created', dataIndex: 'createdAt', render: formatDate },
          ]}
        />
      </section>

      <Modal
        title="Create tenant"
        open={createOpen}
        confirmLoading={saving}
        okText="Create tenant"
        onOk={() => form.submit()}
        onCancel={() => setCreateOpen(false)}
      >
        <Form<TenantForm> form={form} layout="vertical" requiredMark={false} onFinish={create}>
          <Form.Item name="name" label="Tenant name" rules={[{ required: true }]}>
            <Input placeholder="Acme Pay" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Tenant slug"
            rules={[
              { required: true },
              {
                pattern: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/,
                message: 'Use 3-64 lowercase letters, digits, or internal hyphens',
              },
            ]}
          >
            <Input placeholder="acme-pay" />
          </Form.Item>
          <Form.Item
            name="adminEmail"
            label="Tenant admin email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="adminDisplayName" label="Admin display name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="adminPassword"
            label="Initial admin password"
            rules={[{ required: true }, { min: 12 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selected?.name}
        size={420}
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
      >
        {selected ? (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Slug">{selected.slug}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusText value={selected.status} /></Descriptions.Item>
              <Descriptions.Item label="Derivation namespace">
                {selected.derivationNamespace}
              </Descriptions.Item>
              <Descriptions.Item label="IP allowlist">
                {selected.ipAllowlistEnabled ? 'Enforced' : 'Off'}
              </Descriptions.Item>
              <Descriptions.Item label="Addresses">{selected.addressCount}</Descriptions.Item>
              <Descriptions.Item label="Deposits">{selected.depositCount}</Descriptions.Item>
              <Descriptions.Item label="Withdrawals">{selected.withdrawalCount}</Descriptions.Item>
              <Descriptions.Item label="Created">{formatDate(selected.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Updated">{formatDate(selected.updatedAt)}</Descriptions.Item>
            </Descriptions>
            <div className="drawer-danger-zone">
              <h3>Tenant controls</h3>
              <Popconfirm
                title={selected.status === 'ACTIVE' ? 'Suspend this tenant?' : 'Activate this tenant?'}
                description={
                  selected.status === 'ACTIVE'
                    ? 'All API requests and tenant Console sessions will be rejected.'
                    : 'Tenant credentials and Console access will become active again.'
                }
                onConfirm={() => void changeStatus(selected)}
              >
                <Button danger={selected.status === 'ACTIVE'}>
                  {selected.status === 'ACTIVE' ? 'Suspend tenant' : 'Activate tenant'}
                </Button>
              </Popconfirm>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
