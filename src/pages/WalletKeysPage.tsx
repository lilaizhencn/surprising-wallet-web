import { useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, Spin, Tag } from 'antd';
import {
  DatabaseOutlined,
  KeyOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from '@ant-design/icons';
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
    <div className="page-stack wallet-keys-page">
      <section className="wallet-key-hero">
        <div className="wallet-key-grid-overlay" aria-hidden />
        <div className="wallet-key-orb wallet-key-orb-one" aria-hidden />
        <div className="wallet-key-orb wallet-key-orb-two" aria-hidden />
        <div className="wallet-key-eyebrow">
          <SafetyCertificateOutlined />
          <span>{t('Key management system')}</span>
          <i aria-hidden />
          <span>{t('Online')}</span>
        </div>
        <PageHeader
          title={t('Wallet keys')}
          description={t('Manage the four seeds as one atomic wallet keyset.')}
          actions={(
            <Button className="wallet-key-reload" icon={<ReloadOutlined />} onClick={query.refetch}>
              {t('Reload')}
            </Button>
          )}
        />
        <div className="wallet-key-telemetry">
          <div>
            <span>{t('Keyset state')}</span>
            <strong className={query.data?.configured ? 'is-ready' : 'is-pending'}>
              <i aria-hidden />
              {t(query.data?.configured ? 'Configured' : 'Not configured')}
            </strong>
          </div>
          <div>
            <span>{t('Seed slots')}</span>
            <strong>04 / 04</strong>
          </div>
          <div>
            <span>{t('Mutation policy')}</span>
            <strong>{t(query.data?.locked ? 'Read only' : 'Writable')}</strong>
          </div>
          <div>
            <span>{t('Last synchronization')}</span>
            <strong>
              {query.data?.updatedAt ? formatDate(query.data.updatedAt) : '—'}
            </strong>
          </div>
        </div>
      </section>

      <div className="wallet-key-notices">
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
      </div>

      <ErrorState message={query.error} onRetry={query.refetch} />
      <section className="wallet-key-panel">
        {query.loading && !query.data ? <Spin /> : (
          <>
            <header className="wallet-key-panel-header">
              <div className="wallet-key-emblem" aria-hidden>
                <KeyOutlined />
              </div>
              <div>
                <span className="wallet-key-panel-kicker">{t('Atomic keyset')}</span>
                <h2>{t('Seed vault')}</h2>
                <p>{t('Four roots are committed and loaded as one logical unit.')}</p>
              </div>
              <div className="wallet-key-database-state">
                <DatabaseOutlined />
                <span>
                  {query.data?.updatedAt
                    ? t('Updated {time} by {actor}', {
                        time: formatDate(query.data.updatedAt),
                        actor: query.data.updatedBy ?? t('unknown'),
                      })
                    : t('Awaiting initial configuration')}
                </span>
              </div>
            </header>
            <Form<WalletKeysetInput>
              form={form}
              className="wallet-key-form"
              layout="vertical"
              requiredMark={false}
              onFinish={save}
            >
              <div className="wallet-seed-grid">
                {fields.map((field, index) => (
                  <div className="wallet-seed-card" key={field.name}>
                    <div className="wallet-seed-card-topline">
                      <span className="wallet-seed-index">0{index + 1}</span>
                      <Tag bordered={false}>{index === 3 ? 'ED25519' : 'BIP32'}</Tag>
                    </div>
                    <Form.Item
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
                      <Input.Password
                        visibilityToggle
                        readOnly={query.data?.locked}
                        autoComplete="off"
                        placeholder={t('Base64-encoded 32-byte seed')}
                      />
                    </Form.Item>
                  </div>
                ))}
              </div>
              <footer className="wallet-key-form-footer">
                <div>
                  <LockOutlined />
                  <span>
                    {t(query.data?.locked
                      ? 'Address derivation detected · keyset mutation disabled'
                      : 'Changes are committed for all four seeds together')}
                  </span>
                </div>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={query.loading || query.data?.locked}
                >
                  {t('Save all four seeds')}
                </Button>
              </footer>
            </Form>
          </>
        )}
      </section>
    </div>
  );
}
