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
import { useI18n } from '../i18n';
import { formatDate } from '../utils/format';
import WebhookAccessSection from './WebhooksPage';

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
  'chains:read',
  'deposits:read',
  'withdrawals:read',
  'withdrawals:write',
].map((value) => ({ value, label: value }));

export default function ApiAccessPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
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
        api.get<ApiKeyRow[]>('/custody/console/v1/api-keys', signal),
        api.get<Allowlist>('/custody/console/v1/ip-allowlist', signal),
      ]);
      return { keys, allowlist };
    },
    [session?.userId],
  );

  const createKey = async (values: { name: string; scopes: string[] }) => {
    if (!session) return;
    setSaving(true);
    try {
      const result = await api.post<CreatedApiKey>(
        '/custody/console/v1/api-keys',
        values,
      );
      setKeyModal(false);
      setCreatedKey(result);
      keyForm.resetFields();
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to create API key'));
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (row: ApiKeyRow) => {
    if (!session) return;
    try {
      await api.delete(`/custody/console/v1/api-keys/${row.id}`);
      await message.success(t('API key revoked'));
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to revoke API key'));
    }
  };

  const toggleAllowlist = async (enabled: boolean) => {
    if (!session) return;
    try {
      await api.put('/custody/console/v1/ip-allowlist/enforcement', { enabled });
      await message.success(enabled ? t('IP allowlist enforced') : t('IP allowlist disabled'));
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to change IP allowlist'));
    }
  };

  const addRule = async (values: { label: string; cidr: string }) => {
    if (!session) return;
    setSaving(true);
    try {
      await api.post('/custody/console/v1/ip-allowlist/rules', values);
      setRuleModal(false);
      ruleForm.resetFields();
      await message.success(t('IP rule added'));
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to add IP rule'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (row: IpRule) => {
    if (!session) return;
    try {
      await api.delete(`/custody/console/v1/ip-allowlist/rules/${row.id}`);
      query.refetch();
    } catch (error) {
      void message.error(error instanceof Error ? error.message : t('Unable to delete IP rule'));
    }
  };

  const allowlist = query.data?.allowlist ?? { enabled: false, rules: [] };

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Developer access')}
        description={t('Manage API credentials, trusted networks, callback endpoints, and delivery failures in one place.')}
      />
      <ErrorState message={query.error} onRetry={query.refetch} />
      <Alert
        showIcon
        type="info"
        title={t('Server integration flow')}
        description={t('Create a least-privilege API key, optionally enforce trusted source networks, then add and verify a Webhook endpoint. API-created address events are delivered automatically.')}
      />
      <div className="security-grid">
        <section className="data-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('API keys')}</h2>
              <p>{t('Secrets are displayed once and encrypted at rest.')}</p>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setKeyModal(true)}>
              {t('Create API key')}
            </Button>
          </div>
          <Table<ApiKeyRow>
            rowKey="id"
            loading={query.loading}
            dataSource={query.data?.keys ?? []}
            locale={{ emptyText: <Empty description={t('No API keys created')} /> }}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 840 }}
            columns={[
              {
                title: t('Name'),
                dataIndex: 'name',
                render: (value, row) => (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{value}</Typography.Text>
                    <Typography.Text copyable type="secondary">{row.keyId}</Typography.Text>
                  </Space>
                ),
              },
              { title: t('Scopes'), dataIndex: 'scopes', render: (value: string[]) => value.join(', ') },
              { title: t('Last used'), dataIndex: 'lastUsedAt', render: formatDate },
              { title: t('Source IP'), dataIndex: 'lastUsedIp', render: (value) => value || '—' },
              { title: t('Created'), dataIndex: 'createdAt', render: formatDate },
              { title: t('Status'), dataIndex: 'status', render: (value) => <StatusText value={value} /> },
              {
                title: '',
                render: (_, row) => row.status === 'ACTIVE' ? (
                  <Popconfirm
                    title={t('Revoke this API key?')}
                    description={t('Existing clients using this key will be rejected immediately.')}
                    onConfirm={() => void revokeKey(row)}
                  >
                    <Button danger type="text" icon={<StopOutlined />}>{t('Revoke')}</Button>
                  </Popconfirm>
                ) : null,
              },
            ]}
          />
        </section>

        <section className="data-panel allowlist-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('IP allowlist')}</h2>
              <p>{t('Apply enabled CIDR rules to every API key for this tenant.')}</p>
            </div>
            <Switch
              checked={allowlist.enabled}
              checkedChildren={t('Enforced')}
              unCheckedChildren={t('Off')}
              onChange={(checked) => void toggleAllowlist(checked)}
            />
          </div>
          {!allowlist.rules.length ? (
            <Alert
              showIcon
              type="warning"
              title={t('Add at least one rule before enabling enforcement.')}
            />
          ) : null}
          <div className="panel-subaction">
            <Button icon={<PlusOutlined />} onClick={() => setRuleModal(true)}>{t('Add rule')}</Button>
          </div>
          <Table<IpRule>
            rowKey="id"
            size="small"
            loading={query.loading}
            dataSource={allowlist.rules}
            pagination={false}
            locale={{ emptyText: <Empty description={t('No trusted network rules')} /> }}
            columns={[
              { title: t('Label'), dataIndex: 'label' },
              { title: 'CIDR', dataIndex: 'cidr' },
              {
                title: t('Status'),
                dataIndex: 'enabled',
                render: (value: boolean) => <StatusText value={value ? 'ACTIVE' : 'DISABLED'} />,
              },
              {
                title: '',
                render: (_, row) => (
                  <Popconfirm
                    title={t('Delete this IP rule?')}
                    onConfirm={() => void deleteRule(row)}
                  >
                    <Button type="text" danger>{t('Delete')}</Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        </section>
      </div>

      <WebhookAccessSection />

      <Modal
        title={t('Create API key')}
        open={keyModal}
        confirmLoading={saving}
        okText={t('Create API key')}
        onOk={() => keyForm.submit()}
        onCancel={() => setKeyModal(false)}
      >
        <Form form={keyForm} layout="vertical" requiredMark={false} onFinish={createKey}>
          <Form.Item name="name" label={t('Name')} rules={[{ required: true }]}>
            <Input placeholder={t('Production backend')} />
          </Form.Item>
          <Form.Item name="scopes" label={t('Scopes')} rules={[{ required: true }]}>
            <Select mode="multiple" options={scopeOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('API key created')}
        open={Boolean(createdKey)}
        closable={false}
        mask={{ closable: false }}
        footer={
          <Button type="primary" onClick={() => setCreatedKey(undefined)}>
            {t('I saved the secret')}
          </Button>
        }
      >
        <Alert
          showIcon
          type="success"
          title={t('Copy the key ID and secret now. The secret will not be shown again.')}
        />
        <div className="secret-fields">
          <label>{t('Key ID')}</label>
          <Input
            readOnly
            value={createdKey?.keyId}
            addonAfter={<CopyOutlined onClick={() => createdKey && void navigator.clipboard.writeText(createdKey.keyId)} />}
          />
          <label>{t('Secret')}</label>
          <Input
            readOnly
            value={createdKey?.secret}
            addonAfter={<CopyOutlined onClick={() => createdKey && void navigator.clipboard.writeText(createdKey.secret)} />}
          />
        </div>
      </Modal>

      <Modal
        title={t('Add IP rule')}
        open={ruleModal}
        confirmLoading={saving}
        okText={t('Add rule')}
        onOk={() => ruleForm.submit()}
        onCancel={() => setRuleModal(false)}
      >
        <Form form={ruleForm} layout="vertical" requiredMark={false} onFinish={addRule}>
          <Form.Item name="label" label={t('Label')} rules={[{ required: true }]}>
            <Input placeholder={t('Production NAT gateway')} />
          </Form.Item>
          <Form.Item
            name="cidr"
            label={t('IPv4 or IPv6 CIDR')}
            rules={[{ required: true }]}
            extra={t('Examples: 203.0.113.20/32 or 2001:db8:1200::/48')}
          >
            <Input placeholder="203.0.113.20/32" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
