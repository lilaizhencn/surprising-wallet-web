import { useState } from 'react';
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import type {
  TenantPageResponse,
  TenantStatus,
  TenantSummary,
} from '../types/platform';
import { formatDate, queryString } from '../utils/format';

type TenantForm = {
  slug: string;
  name: string;
  adminEmail: string;
  adminDisplayName: string;
  adminPassword: string;
};

const PAGE_SIZE = 20;

export default function TenantsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<TenantForm>();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [page, setPage] = useState(1);

  const query = useApiQuery<TenantPageResponse>(
    (signal) => session
      ? api.get(
        `/custody/platform/v1/tenants${queryString({
          search,
          status,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        })}`,
        session.token,
        signal,
      )
      : Promise.resolve({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 }),
    [session?.token, search, status, page],
  );

  const create = async (values: TenantForm) => {
    if (!session) return;
    setSaving(true);
    try {
      const tenant = await api.post<TenantSummary>(
        '/custody/platform/v1/tenants',
        session.token,
        values,
      );
      await message.success('Tenant created');
      setCreateOpen(false);
      form.resetFields();
      navigate(`/platform/tenants/${tenant.id}`);
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const openTenant = (tenantId: string) => {
    navigate(`/platform/tenants/${tenantId}`);
  };

  const applySearch = (value: string) => {
    setPage(1);
    setSearch(value.trim());
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Tenants"
        description="Create, find, inspect, and control every isolated custody customer."
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={query.refetch}>Reload</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create tenant
            </Button>
          </Space>
        }
      />

      <section className="data-panel tenant-filter-panel">
        <Input.Search
          aria-label="Search tenants"
          allowClear
          value={searchDraft}
          prefix={<SearchOutlined />}
          placeholder="Search by tenant name or slug"
          enterButton="Search"
          onChange={(event) => setSearchDraft(event.target.value)}
          onSearch={applySearch}
        />
        <Select<TenantStatus | ''>
          aria-label="Filter tenant status"
          value={status}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'SUSPENDED', label: 'Suspended' },
          ]}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
        />
      </section>

      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <Table<TenantSummary>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data?.items ?? []}
          locale={{ emptyText: <Empty description="No tenants match these filters" /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: query.data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (total) => `${total} tenants`,
          }}
          onChange={(pagination) => setPage(pagination.current ?? 1)}
          onRow={(row) => ({ onClick: () => openTenant(row.id) })}
          rowClassName="clickable-row"
          scroll={{ x: 1120 }}
          columns={[
            {
              title: 'Tenant',
              render: (_, row) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{row.name}</Typography.Text>
                  <Typography.Text type="secondary">{row.slug}</Typography.Text>
                </Space>
              ),
            },
            { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
            { title: 'Addresses', dataIndex: 'addressCount', align: 'right' },
            { title: 'Deposits', dataIndex: 'depositCount', align: 'right' },
            { title: 'Withdrawals', dataIndex: 'withdrawalCount', align: 'right' },
            {
              title: 'Setup',
              render: (_, row) => (
                <StatusText
                  value={
                    row.activeWebhookCount > 0
                    && row.activeApiKeyCount > 0
                    && row.gasAccountCount > 0
                    && row.ipAllowlistEnabled
                      ? 'READY'
                      : 'SETUP_REQUIRED'
                  }
                />
              ),
            },
            {
              title: 'Webhook failures',
              dataIndex: 'failedWebhookDeliveryCount',
              align: 'right',
              render: (value: number) => value || '—',
            },
            { title: 'Created', dataIndex: 'createdAt', render: formatDate },
            {
              title: '',
              fixed: 'right',
              width: 70,
              render: (_, row) => (
                <Button
                  type="text"
                  aria-label={`View ${row.name}`}
                  icon={<EyeOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openTenant(row.id);
                  }}
                />
              ),
            },
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
            extra="This stable integration identifier cannot be changed later."
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
            <Input autoComplete="email" />
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
    </div>
  );
}
