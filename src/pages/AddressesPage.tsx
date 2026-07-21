import { useMemo, useState } from 'react';
import {
  App,
  AutoComplete,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
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
import { hasScope, useSession } from '../auth/session';
import { CopyText } from '../components/CopyText';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { commonChainOptions } from '../constants/chains';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatDate, queryString } from '../utils/format';
import { useI18n } from '../i18n';

type AddressRow = {
  id: string;
  chain: string;
  network: string;
  address: string;
  memo?: string;
  subject: string;
  addressVersion: number;
  label?: string;
  metadata: Record<string, unknown>;
  source: 'API' | 'CONSOLE';
  status: string;
  createdAt: string;
};

type CreateAddressValues = {
  chain: string;
  subject: string;
  addressVersion?: number;
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
  const canWrite = hasScope(session, 'addresses:write');
  const { message } = App.useApp();
  const { t } = useI18n();
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
          signal,
        )
      : Promise.resolve([]),
    [session?.userId, filters.chain, filters.source, filters.status, filters.search],
  );

  const createAddress = async (values: CreateAddressValues) => {
    if (!session) return;
    setCreating(true);
    try {
      let metadata: Record<string, unknown> = {};
      if (values.metadata?.trim()) {
        const parsed = JSON.parse(values.metadata) as unknown;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error(t('Metadata must be a JSON object'));
        }
        metadata = parsed as Record<string, unknown>;
      }
      await api.post('/custody/console/v1/addresses', {
        chain: values.chain,
        subject: values.subject,
        addressVersion: values.addressVersion ?? 0,
        label: values.label,
        metadata,
      });
      await message.success(t('Deposit address created'));
      form.resetFields();
      setDrawerOpen(false);
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to create address'));
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
          throw new Error(t('Metadata must be a JSON object'));
        }
        metadata = parsed as Record<string, unknown>;
      }
      await api.patch(
        `/custody/console/v1/addresses/${editingAddress.id}`,
        {
          label: values.label ?? '',
          status: values.status,
          metadata,
        },
      );
      await message.success(t('Address settings saved'));
      setEditingAddress(undefined);
      editForm.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to update address'));
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
        title={t('Addresses')}
        description={t('Tenant-owned deposit addresses created through the API or Console.')}
        actions={canWrite ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            {t('Create address')}
          </Button>
        ) : undefined}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel">
        <div className="table-toolbar">
          <Select
            allowClear
            placeholder={t('Network')}
            options={networkOptions}
            style={{ minWidth: 150 }}
            onChange={(chain = '') => setFilters((current) => ({ ...current, chain }))}
          />
          <Select
            allowClear
            placeholder={t('Source')}
            options={[
              { value: 'API', label: 'API' },
              { value: 'CONSOLE', label: t('Console') },
            ]}
            style={{ minWidth: 130 }}
            onChange={(source = '') => setFilters((current) => ({ ...current, source }))}
          />
          <Select
            allowClear
            placeholder={t('Status')}
            options={[
              { value: 'ACTIVE', label: t('Active') },
              { value: 'DISABLED', label: t('Disabled') },
            ]}
            style={{ minWidth: 130 }}
            onChange={(status = '') => setFilters((current) => ({ ...current, status }))}
          />
          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('Search address or subject')}
            style={{ width: 330 }}
            onSearch={(search) => setFilters((current) => ({ ...current, search }))}
          />
          <Button aria-label={t('Reload addresses')} icon={<ReloadOutlined />} onClick={query.refetch} />
        </div>
        <Table<AddressRow>
          rowKey="id"
          loading={query.loading}
          dataSource={query.data ?? []}
          locale={{ emptyText: <Empty description={t('No deposit addresses yet')} /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 1120 }}
          columns={[
            {
              title: t('Address'),
              dataIndex: 'address',
              width: 210,
              render: (value: string, row) => (
                <Space orientation="vertical" size={0}>
                  <CopyText value={value} />
                  {row.memo ? <small>{t('Memo')}: {row.memo}</small> : null}
                </Space>
              ),
            },
            { title: t('Network'), dataIndex: 'chain', width: 110 },
            { title: t('Environment'), dataIndex: 'network', width: 120 },
            {
              title: t('Subject'),
              dataIndex: 'subject',
            },
            { title: t('Address version'), dataIndex: 'addressVersion', width: 130 },
            { title: t('Label'), dataIndex: 'label', render: (value?: string) => value || '—' },
            { title: t('Source'), dataIndex: 'source', width: 100, render: (value: string) => t(value === 'CONSOLE' ? 'Console' : value) },
            { title: t('Created'), dataIndex: 'createdAt', width: 180, render: formatDate },
            {
              title: t('Status'),
              dataIndex: 'status',
              width: 120,
              render: (value) => <StatusText value={value} />,
            },
            {
              title: '',
              fixed: 'right',
              width: 110,
              render: (_, row) => canWrite ? (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openAddressManager(row)}
                >
                  {t('Manage')}
                </Button>
              ) : null,
            },
          ]}
        />
      </section>

      <Drawer
        title={t('Create address')}
        size={440}
        open={drawerOpen}
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        extra={<Button onClick={() => setDrawerOpen(false)}>{t('Cancel')}</Button>}
      >
        <Form<CreateAddressValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ addressVersion: 0 }}
          onFinish={createAddress}
        >
          <Form.Item
            name="chain"
            label={t('Network')}
            rules={[{ required: true, message: t('Select or enter a network') }]}
            extra={t('An EVM network address can receive its enabled native and token assets.')}
          >
            <AutoComplete options={commonChainOptions} placeholder="ETH" filterOption />
          </Form.Item>
          <Form.Item
            name="subject"
            label={t('Subject')}
            rules={[{ required: true, message: t('Enter a stable subject') }]}
            extra={t('The same subject and address version always return the same address across EVM chains.')}
          >
            <Input maxLength={160} placeholder="user_10086" />
          </Form.Item>
          <Form.Item
            name="addressVersion"
            label={t('Address version')}
            rules={[{ required: true, message: t('Enter an address version') }]}
            extra={t('Keep 0 for the first address. Increase the version when this subject needs a new address; older addresses remain monitored.')}
          >
            <InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="label" label={t('Label (optional)')}>
            <Input maxLength={160} placeholder={t('Primary deposit address')} />
          </Form.Item>
          <Form.Item
            name="metadata"
            label={t('Metadata (optional)')}
            extra={t('Stored for tenant lookup only. It does not create a wallet user.')}
          >
            <Input.TextArea
              rows={7}
              placeholder={'{\n  "customerTier": "business"\n}'}
              spellCheck={false}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={creating}>
            {t('Create deposit address')}
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title={t('Manage address')}
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
            {t('Cancel')}
          </Button>
        }
      >
        {editingAddress ? (
          <>
            <div className="address-manager-identity">
              <span>{editingAddress.chain} · {editingAddress.network}</span>
              <CopyText value={editingAddress.address} />
              <small>{t('Subject')}: {editingAddress.subject}</small>
              <small>{t('Address version')}: {editingAddress.addressVersion}</small>
            </div>
            <Form<UpdateAddressValues>
              form={editForm}
              layout="vertical"
              requiredMark={false}
              onFinish={updateAddress}
            >
              <Form.Item name="label" label={t('Label')}>
                <Input maxLength={160} placeholder={t('Primary deposit address')} />
              </Form.Item>
              <Form.Item
                name="status"
                label={t('Status')}
                rules={[{ required: true }]}
                extra={t('Disabled addresses remain monitored so existing funds and late deposits are never hidden.')}
              >
                <Select
                  options={[
                    { value: 'ACTIVE', label: t('Active') },
                    { value: 'DISABLED', label: t('Disabled') },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="metadata"
                label={t('Metadata')}
                extra={t('Tenant-owned lookup data only.')}
              >
                <Input.TextArea rows={8} spellCheck={false} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={saving}>
                {t('Save address settings')}
              </Button>
            </Form>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
