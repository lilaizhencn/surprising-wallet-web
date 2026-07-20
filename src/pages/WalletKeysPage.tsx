import { useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, Space, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { useApiQuery } from '../hooks/useApiQuery';
import type { WalletKeyset, WalletKeysetInput } from '../types/platform';
import { formatDate } from '../utils/format';
import { useI18n } from '../i18n';

const endpoint = '/custody/platform/v1/wallet-config/keyset';

const fields: Array<{
  name: keyof WalletKeysetInput;
  label: string;
  help: string;
}> = [
  { name: 'sig1Seed', label: 'Sig1 BIP32 Seed', help: 'First signer private root.' },
  { name: 'sig2Seed', label: 'Sig2 BIP32 Seed', help: 'Second signer and wallet-server account-chain root.' },
  { name: 'recoverySeed', label: 'Recovery BIP32 Seed', help: 'Third multisig recovery root.' },
  { name: 'ed25519Seed', label: 'Ed25519 Seed', help: 'SOLANA, TON, APTOS, SUI, ADA, DOT, and NEAR root.' },
];

export default function WalletKeysPage() {
  const session = useSession();
  const { message } = App.useApp();
  const { t } = useI18n();
  const [form] = Form.useForm<WalletKeysetInput>();
  const [saving, setSaving] = useState(false);
  const query = useApiQuery<WalletKeyset>(
    (signal) => session
      ? api.get(endpoint, session.token, signal)
      : Promise.resolve({ configured: false, locked: false }),
    [session?.token],
  );

  useEffect(() => {
    if (!query.data) return;
    form.setFieldsValue({
      sig1Seed: query.data.sig1Seed ?? '',
      sig2Seed: query.data.sig2Seed ?? '',
      recoverySeed: query.data.recoverySeed ?? '',
      ed25519Seed: query.data.ed25519Seed ?? '',
    });
  }, [form, query.data]);

  const save = async (values: WalletKeysetInput) => {
    if (!session) return;
    setSaving(true);
    try {
      await api.put<WalletKeyset>(endpoint, session.token, values);
      await message.success(t('Wallet keyset saved'));
      query.refetch();
    } catch (error) {
      void message.error(t(error instanceof Error ? error.message : 'Unable to save wallet keyset'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t('Wallet keys')}
        description={t('Manage the four seeds as one atomic wallet keyset.')}
        actions={<Button icon={<ReloadOutlined />} onClick={query.refetch}>{t('Reload')}</Button>}
      />

      <Alert
        type="warning"
        showIcon
        title={t('Development-only plaintext storage')}
        description={t('All four values are stored as plaintext in PostgreSQL and returned by this page. Each value must be Base64 and decode to exactly 32 bytes. Start or restart sig1 and sig2 after saving so their JVMs load the keyset.')}
      />
      {query.data?.locked ? (
        <Alert
          type="info"
          showIcon
          title={t('Keyset locked')}
          description={t('Derived addresses already exist, so the keyset can be viewed but cannot be changed.')}
        />
      ) : null}

      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="data-panel wallet-key-panel">
        {query.loading && !query.data ? <Spin /> : (
          <>
            <Space wrap className="wallet-key-status">
              <Tag color={query.data?.configured ? 'green' : 'gold'}>
                {t(query.data?.configured ? 'Configured' : 'Not configured')}
              </Tag>
              {query.data?.updatedAt ? (
                <Typography.Text type="secondary">
                  {t('Updated {time} by {actor}', { time: formatDate(query.data.updatedAt), actor: query.data.updatedBy ?? t('unknown') })}
                </Typography.Text>
              ) : null}
            </Space>
            <Form<WalletKeysetInput>
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={save}
              disabled={query.data?.locked}
            >
              {fields.map((field) => (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={t(field.label)}
                  extra={t(field.help)}
                  rules={[
                    { required: true, message: t('{field} is required', { field: t(field.label) }) },
                    {
                      validator: (_, value: string) => {
                        try {
                          const bytes = Uint8Array.from(atob(value.trim()), (character) => character.charCodeAt(0));
                          return bytes.length === 32
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('Must decode to exactly 32 bytes')));
                        } catch {
                          return Promise.reject(new Error(t('Must be valid Base64')));
                        }
                      },
                    },
                  ]}
                >
                  <Input.Password visibilityToggle autoComplete="off" placeholder={t('Base64-encoded 32-byte seed')} />
                </Form.Item>
              ))}
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={query.loading || query.data?.locked}
              >
                {t('Save all four seeds')}
              </Button>
            </Form>
          </>
        )}
      </section>
    </div>
  );
}
