import { useState } from 'react';
import {
  Alert,
  App,
  Button,
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
import { CopyOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatDate } from '../utils/format';

type ApiKeyRow = {
  id: string;
  keyId: string;
  name: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string;
  lastUsedIp?: string;
  createdAt: string;
};

type CreatedApiKey = ApiKeyRow & { secret: string };

type IpRule = {
  id: string;
  label: string;
  cidr: string;
  enabled: boolean;
  createdAt: string;
};

type Allowlist = { enabled: boolean; rules: IpRule[] };

const scopeOptions = [
  'addresses:read',
  'addresses:write',
  'assets:read',
  'deposits:read',
  'withdrawals:read',
  'withdrawals:write',
].map((value) => ({ value, label: value }));

export default function ApiAccessPage() {
  const session = useSession();
  const { message } = App.useApp();
  const [keyForm] = Form.useForm<{ name: string; scopes: string[] }>();
  const [ruleForm] = Form.useForm<{ label: string; cidr: string }>();
  const [keyModal, setKeyModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey>();
  const [saving, setSaving] = useState(false);

  const query = useApiQuery<{ keys: ApiKeyRow[]; allowlist: Allowlist }>(
    async (signal) => {
      if (!session) return { keys: [], allowlist: { enabled: false, rules: [] } };
      const [keys, allowlist] = await Promise.all([
        api.get<ApiKeyRow[]>('/custody/console/v1/api-keys', session.token, signal),
        api.get<Allowlist>('/custody/console/v1/ip-allowlist', session.token, signal),
      ]);
      return { keys, allowlist };
    },
    [session?.token],
  );

  const createKey = async (values: { name: string; scopes: string[] }) => {
    if (!session) return;
    setSaving(true);
    try {
      const result = await api.post<CreatedApiKey>(
        '/custody/console/v1/api-keys',
        session.token,
        values,
      );
      setKeyModal(false);
      setCreatedKey(result);
      keyForm.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to create API key');
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (row: ApiKeyRow) => {
    if (!session) return;
    try {
      await api.delete(`/custody/console/v1/api-keys/${row.id}`, session.token);
      await message.success('API key revoked');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to revoke API key');
    }
  };

  const toggleAllowlist = async (enabled: boolean) => {
    if (!session) return;
    try {
      await api.put('/custody/console/v1/ip-allowlist/enforcement', session.token, { enabled });
      await message.success(enabled ? 'IP allowlist enforced' : 'IP allowlist disabled');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to change IP allowlist');
    }
  };

  const addRule = async (values: { label: string; cidr: string }) => {
    if (!session) return;
    setSaving(true);
    try {
      await api.post('/custody/console/v1/ip-allowlist/rules', session.token, values);
      setRuleModal(false);
      ruleForm.resetFields();
      await message.success('IP rule added');
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to add IP rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (row: IpRule) => {
    if (!session) return;
    try {
      await api.delete(`/custody/console/v1/ip-allowlist/rules/${row.id}`, session.token);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Unable to delete IP rule');
    }
  };

  const allowlist = query.data?.allowlist ?? { enabled: false, rules: [] };

  return (
    <div className="page-stack">
      <PageHeader
        title="API access"
        description="Manage service credentials, request scopes, and source-network enforcement."
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <div className="security-grid">
        <section className="data-panel">
          <div className="panel-heading">
            <div>
              <h2>API keys</h2>
              <p>Secrets are displayed once and encrypted at rest.</p>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setKeyModal(true)}>
              Create API key
            </Button>
          </div>
          <Table<ApiKeyRow>
            rowKey="id"
            loading={query.loading}
            dataSource={query.data?.keys ?? []}
            locale={{ emptyText: <Empty description="No API keys created" /> }}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 840 }}
            columns={[
              {
                title: 'Name',
                dataIndex: 'name',
                render: (value, row) => (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{value}</Typography.Text>
                    <Typography.Text copyable type="secondary">{row.keyId}</Typography.Text>
                  </Space>
                ),
              },
              { title: 'Scopes', dataIndex: 'scopes', render: (value: string[]) => value.join(', ') },
              { title: 'Last used', dataIndex: 'lastUsedAt', render: formatDate },
              { title: 'Source IP', dataIndex: 'lastUsedIp', render: (value) => value || '—' },
              { title: 'Created', dataIndex: 'createdAt', render: formatDate },
              { title: 'Status', dataIndex: 'status', render: (value) => <StatusText value={value} /> },
              {
                title: '',
                render: (_, row) => row.status === 'ACTIVE' ? (
                  <Popconfirm
                    title="Revoke this API key?"
                    description="Existing clients using this key will be rejected immediately."
                    onConfirm={() => void revokeKey(row)}
                  >
                    <Button danger type="text" icon={<StopOutlined />}>Revoke</Button>
                  </Popconfirm>
                ) : null,
              },
            ]}
          />
        </section>

        <section className="data-panel allowlist-panel">
          <div className="panel-heading">
            <div>
              <h2>IP allowlist</h2>
              <p>Apply enabled CIDR rules to every API key for this tenant.</p>
            </div>
            <Switch
              checked={allowlist.enabled}
              checkedChildren="Enforced"
              unCheckedChildren="Off"
              onChange={(checked) => void toggleAllowlist(checked)}
            />
          </div>
          {!allowlist.rules.length ? (
            <Alert
              showIcon
              type="warning"
              title="Add at least one rule before enabling enforcement."
            />
          ) : null}
          <div className="panel-subaction">
            <Button icon={<PlusOutlined />} onClick={() => setRuleModal(true)}>Add rule</Button>
          </div>
          <Table<IpRule>
            rowKey="id"
            size="small"
            loading={query.loading}
            dataSource={allowlist.rules}
            pagination={false}
            locale={{ emptyText: <Empty description="No trusted network rules" /> }}
            columns={[
              { title: 'Label', dataIndex: 'label' },
              { title: 'CIDR', dataIndex: 'cidr' },
              {
                title: 'Status',
                dataIndex: 'enabled',
                render: (value: boolean) => <StatusText value={value ? 'ACTIVE' : 'DISABLED'} />,
              },
              {
                title: '',
                render: (_, row) => (
                  <Popconfirm
                    title="Delete this IP rule?"
                    onConfirm={() => void deleteRule(row)}
                  >
                    <Button type="text" danger>Delete</Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        </section>
      </div>

      <Modal
        title="Create API key"
        open={keyModal}
        confirmLoading={saving}
        okText="Create API key"
        onOk={() => keyForm.submit()}
        onCancel={() => setKeyModal(false)}
      >
        <Form form={keyForm} layout="vertical" requiredMark={false} onFinish={createKey}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Production backend" />
          </Form.Item>
          <Form.Item name="scopes" label="Scopes" rules={[{ required: true }]}>
            <Select mode="multiple" options={scopeOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="API key created"
        open={Boolean(createdKey)}
        closable={false}
        mask={{ closable: false }}
        footer={
          <Button type="primary" onClick={() => setCreatedKey(undefined)}>
            I saved the secret
          </Button>
        }
      >
        <Alert
          showIcon
          type="success"
          title="Copy the key ID and secret now. The secret will not be shown again."
        />
        <div className="secret-fields">
          <label>Key ID</label>
          <Input
            readOnly
            value={createdKey?.keyId}
            addonAfter={<CopyOutlined onClick={() => createdKey && void navigator.clipboard.writeText(createdKey.keyId)} />}
          />
          <label>Secret</label>
          <Input
            readOnly
            value={createdKey?.secret}
            addonAfter={<CopyOutlined onClick={() => createdKey && void navigator.clipboard.writeText(createdKey.secret)} />}
          />
        </div>
      </Modal>

      <Modal
        title="Add IP rule"
        open={ruleModal}
        confirmLoading={saving}
        okText="Add rule"
        onOk={() => ruleForm.submit()}
        onCancel={() => setRuleModal(false)}
      >
        <Form form={ruleForm} layout="vertical" requiredMark={false} onFinish={addRule}>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="Production NAT gateway" />
          </Form.Item>
          <Form.Item
            name="cidr"
            label="IPv4 or IPv6 CIDR"
            rules={[{ required: true }]}
            extra="Examples: 203.0.113.20/32 or 2001:db8:1200::/48"
          >
            <Input placeholder="203.0.113.20/32" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
