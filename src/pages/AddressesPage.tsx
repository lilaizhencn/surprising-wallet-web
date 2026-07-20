import { useMemo, useState } from 'react';
import {
  App,
  AutoComplete,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { commonChainOptions } from '../constants/chains';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatDate, queryString } from '../utils/format';

type AddressRow = {
  id: string;
  chain: string;
  network: string;
  address: string;
  memo?: string;
  externalReference?: string;
  label?: string;
  metadata: Record<string, unknown>;
  source: 'API' | 'CONSOLE';
  status: string;
  createdAt: string;
};

type CreateAddressValues = {
  chain: string;
  externalReference?: string;
  label?: string;
  metadata?: string;
};

type UpdateAddressValues = {
  label?: string;
  status: 'ACTIVE' | 'DISABLED';
  metadata?: string;
};

export default function AddressesPage() {
  const session = useSession();
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateAddressValues>();
  const [editForm] = Form.useForm<UpdateAddressValues>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressRow>();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ chain: '', source: '', status: '', search: '' });

  const query = useApiQuery<AddressRow[]>(
    (signal) => session
      ? api.get(
          `/custody/console/v1/addresses${queryString({ ...filters, limit: 100 })}`,
          session.token,
          signal,
        )
      : Promise.resolve([]),
    [session?.token, filters.chain, filters.source, filters.status, filters.search],
  );

  const createAddress = async (values: CreateAddressValues) => {
    if (!session) return;
    setCreating(true);
    try {
      let metadata: Record<string, unknown> = {};
      if (values.metadata?.trim()) {
        const parsed = JSON.parse(values.metadata) as unknown;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('Metadata must be a JSON object');
        }
        metadata = parsed as Record<string, unknown>;
      }
      await api.post('/custody/console/v1/addresses', session.token, {
        chain: values.chain,
        externalReference: values.externalReference,
        label: values.label,
        metadata,
      });
      await message.success('Deposit address created');
      form.resetFields();
      setDrawerOpen(false);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to create address');
    } finally {
      setCreating(false);
    }
  };

  const openAddressManager = (row: AddressRow) => {
    setEditingAddress(row);
    editForm.setFieldsValue({
      label: row.label,
      status: row.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
      metadata: Object.keys(row.metadata ?? {}).length
        ? JSON.stringify(row.metadata, null, 2)
        : '',
    });
  };

  const updateAddress = async (values: UpdateAddressValues) => {
    if (!session || !editingAddress) return;
    setSaving(true);
    try {
      let metadata: Record<string, unknown> = {};
      if (values.metadata?.trim()) {
        const parsed = JSON.parse(values.metadata) as unknown;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('Metadata must be a JSON object');
        }
        metadata = parsed as Record<string, unknown>;
      }
      await api.patch(
        `/custody/console/v1/addresses/${editingAddress.id}`,
        session.token,
        {
          label: values.label ?? '',
          status: values.status,
          metadata,
        },
      );
      await message.success('Address settings saved');
      setEditingAddress(undefined);
      editForm.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to update address');
    } finally {
      setSaving(false);
    }
  };

  const networkOptions = useMemo(() => {
    const values = new Set<string>(commonChainOptions.map((item) => item.value));
    query.data?.forEach((row) => values.add(row.chain));
    return [...values].toSorted().map((value) => ({ label: value, value }));
  }, [query.data]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Addresses"
        description="Tenant-owned deposit addresses created through the API or Console."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Create address
          </Button>
        }
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <div className="table-toolbar">
          <Select
            allowClear
            placeholder="Network"
            options={networkOptions}
            style={{ minWidth: 150 }}
            onChange={(chain = '') => setFilters((current) => ({ ...current, chain }))}
          />
          <Select
            allowClear
            placeholder="Source"
            options={[
              { value: 'API', label: 'API' },
              { value: 'CONSOLE', label: 'Console' },
            ]}
            style={{ minWidth: 130 }}
            onChange={(source = '') => setFilters((current) => ({ ...current, source }))}
          />
          <Select
            allowClear
            placeholder="Status"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'DISABLED', label: 'Disabled' },
            ]}
            style={{ minWidth: 130 }}
            onChange={(status = '') => setFilters((current) => ({ ...current, status }))}
          />
          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search address or external reference"
            style={{ width: 330 }}
            onSearch={(search) => setFilters((current) => ({ ...current, search }))}
          />
          <Button aria-label="Reload addresses" icon={<ReloadOutlined />} onClick={query.refetch} />
        </div>
        <Table<AddressRow>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data ?? []}
          locale={{ emptyText: <Empty description="No deposit addresses yet" /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 1120 }}
          columns={[
            {
              title: 'Address',
              dataIndex: 'address',
              width: 210,
              render: (value: string, row) => (
                <Space orientation="vertical" size={0}>
                  <CopyText value={value} />
                  {row.memo ? <small>Memo: {row.memo}</small> : null}
                </Space>
              ),
            },
            { title: 'Network', dataIndex: 'chain', width: 110 },
            { title: 'Environment', dataIndex: 'network', width: 120 },
            {
              title: 'External reference',
              dataIndex: 'externalReference',
              render: (value?: string) => value || '—',
            },
            { title: 'Label', dataIndex: 'label', render: (value?: string) => value || '—' },
            { title: 'Source', dataIndex: 'source', width: 100 },
            { title: 'Created', dataIndex: 'createdAt', width: 180, render: formatDate },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 120,
              render: (value) => <StatusText value={value} />,
            },
            {
              title: '',
              fixed: 'right',
              width: 110,
              render: (_, row) => (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openAddressManager(row)}
                >
                  Manage
                </Button>
              ),
            },
          ]}
        />
      </section>

      <Drawer
        title="Create address"
        size={440}
        open={drawerOpen}
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        extra={<Button onClick={() => setDrawerOpen(false)}>Cancel</Button>}
      >
        <Form<CreateAddressValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={createAddress}
        >
          <Form.Item
            name="chain"
            label="Network"
            rules={[{ required: true, message: 'Select or enter a network' }]}
            extra="An EVM network address can receive its enabled native and token assets."
          >
            <AutoComplete options={commonChainOptions} placeholder="ETH" filterOption />
          </Form.Item>
          <Form.Item
            name="externalReference"
            label="Address allocation reference (optional)"
            extra="For one network, the same reference always returns the same address. Leave blank to allocate a new address every time."
          >
            <Input maxLength={160} placeholder="customer-8421:primary-deposit" />
          </Form.Item>
          <Form.Item name="label" label="Label (optional)">
            <Input maxLength={160} placeholder="Primary deposit address" />
          </Form.Item>
          <Form.Item
            name="metadata"
            label="Metadata (optional)"
            extra="Stored for tenant lookup only. It does not create a wallet user."
          >
            <Input.TextArea
              rows={7}
              placeholder={'{\n  "customerTier": "business"\n}'}
              spellCheck={false}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={creating}>
            Create deposit address
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title="Manage address"
        size={440}
        open={Boolean(editingAddress)}
        destroyOnHidden
        onClose={() => {
          setEditingAddress(undefined);
          editForm.resetFields();
        }}
        extra={
          <Button
            onClick={() => {
              setEditingAddress(undefined);
              editForm.resetFields();
            }}
          >
            Cancel
          </Button>
        }
      >
        {editingAddress ? (
          <>
            <div className="address-manager-identity">
              <span>{editingAddress.chain} · {editingAddress.network}</span>
              <CopyText value={editingAddress.address} />
              {editingAddress.externalReference ? (
                <small>Allocation reference: {editingAddress.externalReference}</small>
              ) : (
                <small>Console-managed address without an allocation reference</small>
              )}
            </div>
            <Form<UpdateAddressValues>
              form={editForm}
              layout="vertical"
              requiredMark={false}
              onFinish={updateAddress}
            >
              <Form.Item name="label" label="Label">
                <Input maxLength={160} placeholder="Primary deposit address" />
              </Form.Item>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true }]}
                extra="Disabled addresses remain monitored so existing funds and late deposits are never hidden."
              >
                <Select
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'DISABLED', label: 'Disabled' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="metadata"
                label="Metadata"
                extra="Tenant-owned lookup data only."
              >
                <Input.TextArea rows={8} spellCheck={false} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={saving}>
                Save address settings
              </Button>
            </Form>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
