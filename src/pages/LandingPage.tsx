import { Button } from 'antd';
import {
  ApiOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  KeyOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useI18n } from '../i18n';

const chains = [
  'Ethereum',
  'Bitcoin',
  'Solana',
  'Polygon',
  'Arbitrum',
  'Base',
  'Optimism',
  'Avalanche',
  'Tron',
  'TON',
  'Aptos',
  'Sui',
];

const workflow = [
  {
    icon: <DatabaseOutlined />,
    title: 'Tenant isolation',
    body: 'Each tenant gets isolated address derivation and operational access.',
  },
  {
    icon: <GlobalOutlined />,
    title: 'Receive deposits',
    body: 'Monitor supported networks and credit confirmed on-chain deposits once.',
  },
  {
    icon: <SendOutlined />,
    title: 'Orchestrate withdrawals',
    body: 'Freeze, sign, broadcast, confirm, and audit every withdrawal transition.',
  },
  {
    icon: <LinkOutlined />,
    title: 'Signed webhooks',
    body: 'Deliver tamper-evident deposit and withdrawal events with retries.',
  },
];

export default function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="landing-page">
      <header className="marketing-header">
        <Brand />
        <nav aria-label={t('Main navigation')}>
          <a href="#product">{t('Product')}</a>
          <a href="#chains">{t('Chains')}</a>
          <a href="#security">{t('Security')}</a>
          <Link to="/console/developer-docs">{t('Developers')}</Link>
        </nav>
        <div className="marketing-header-actions">
          <LanguageSwitch compact />
          <Link to="/console/login">
            <Button>{t('Sign in')}</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="hero-section" id="product">
          <div className="hero-copy">
            <h1>{t('Blockchain infrastructure for every product you build')}</h1>
            <p>
              {t('Create deposit addresses, orchestrate secure withdrawals, and operate tenant assets from one custody platform.')}
            </p>
            <div className="hero-actions">
              <Link to="/console/login">
                <Button type="primary" size="large">
                  {t('Open Console')} <ArrowRightOutlined />
                </Button>
              </Link>
              <Link to="/console/developer-docs">
                <Button size="large">{t('Read API docs')} <CodeOutlined /></Button>
              </Link>
            </div>
          </div>
          <div className="hero-console" aria-label={t('Custody address workflow preview')}>
            <div className="preview-topbar">
              <Brand compact />
              <span>Acme Pay</span>
              <span className="preview-environment">{t('Production')}</span>
            </div>
            <div className="preview-body">
              <aside>
                <strong>{t('Overview')}</strong>
                <span className="active">{t('Addresses')}</span>
                <span>{t('Deposits')}</span>
                <span>{t('Withdrawals')}</span>
                <span>{t('Webhooks')}</span>
              </aside>
              <div className="preview-main">
                <div className="preview-title">
                  <div>
                    <strong>{t('Addresses')}</strong>
                    <small>{t('Tenant-isolated deposit addresses')}</small>
                  </div>
                  <span className="preview-create">{t('Create address')}</span>
                </div>
                <div className="preview-table">
                  <div className="preview-row preview-head">
                    <span>{t('Address')}</span><span>{t('Network')}</span><span>{t('Source')}</span><span>{t('Status')}</span>
                  </div>
                  {[
                    ['0x8a7f…c9e2', 'Ethereum', 'API'],
                    ['bc1q4…7a8c', 'Bitcoin', 'Console'],
                    ['7Gd59…pP3k', 'Solana', 'API'],
                  ].map((row) => (
                    <div className="preview-row" key={row[0]}>
                      <span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span>
                      <span className="preview-status"><i /> {t('Active')}</span>
                    </div>
                  ))}
                </div>
                <div className="preview-route">
                  <span><CheckCircleFilled /> {t('Deposit received')}</span>
                  <i />
                  <span><CheckCircleFilled /> {t('Confirmed')}</span>
                  <i />
                  <span><CheckCircleFilled /> {t('Tenant credited')}</span>
                  <i className="pending" />
                  <span>Webhook</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-heading">
            <h2>{t('One custody layer, many businesses')}</h2>
            <p>
              {t('Isolate tenants, streamline operations, and trace addresses, deposits, withdrawals, and signed webhooks end to end.')}
            </p>
          </div>
          <div className="workflow-line">
            {workflow.map((item, index) => (
              <article key={item.title}>
                <div className="workflow-icon">{item.icon}</div>
                <span className="workflow-number">{index + 1}</span>
                <h3>{t(item.title)}</h3>
                <p>{t(item.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="chains-section" id="chains">
          <h2>{t('Built for multi-chain operations')}</h2>
          <div className="chain-rail">
            {chains.map((chain) => <span key={chain}>{chain}</span>)}
          </div>
        </section>

        <section className="security-section" id="security">
          <div className="security-copy">
            <h2>{t('Control every sensitive action')}</h2>
            <p>
              {t('Security boundaries are enforced before an operation reaches chain orchestration or tenant funds.')}
            </p>
            <ul>
              <li><KeyOutlined /><span><strong>{t('API request signing')}</strong>{t('HMAC signatures, timestamp windows, and replay protection.')}</span></li>
              <li><SafetyCertificateOutlined /><span><strong>{t('IP allowlists')}</strong>{t('Restrict service credentials to explicit IPv4 or IPv6 networks.')}</span></li>
              <li><AuditOutlined /><span><strong>{t('Complete audit path')}</strong>{t('Searchable tenant, credential, address, and delivery changes.')}</span></li>
              <li><LinkOutlined /><span><strong>{t('Reliable webhook delivery')}</strong>{t('Exponential retry, delivery history, and manual replay.')}</span></li>
            </ul>
          </div>
          <div className="security-ledger">
            <div className="ledger-heading">
              <strong>{t('Operational controls')}</strong>
              <span>{t('Live')}</span>
            </div>
            <div className="ledger-row ledger-labels">
              <span>{t('Control')}</span><span>{t('Enforcement')}</span><span>{t('State')}</span>
            </div>
            {[
              ['Request signature', 'Before routing', 'Enforced'],
              ['IP allowlist', 'Credential scope', 'Enforced'],
              ['Tenant isolation', 'Every query', 'Enforced'],
              ['Event uniqueness', 'Database constraint', 'Enforced'],
            ].map((row) => (
              <div className="ledger-row" key={row[0]}>
                <span>{t(row[0])}</span><span>{t(row[1])}</span>
                <span className="preview-status"><i />{t(row[2])}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="developers-section" id="developers">
          <div className="developer-code">
            <div className="code-tabs"><span className="active">{t('Create address')}</span><span>{t('Webhook verification')}</span></div>
            <pre>
              <code>{`POST /custody/api/v1/addresses
X-Custody-Key: swk_...
X-Custody-Timestamp: 1784486400
X-Custody-Nonce: 2FSvJwQp1QdwLk2B
X-Custody-Signature: ...

{
  "chainId": "ETH",
  "subject": "customer-8421"
}`}</code>
            </pre>
          </div>
          <div className="developer-copy">
            <ApiOutlined />
            <h2>{t('Integrate once. Keep building.')}</h2>
            <p>
              {t('Tenant identity comes from the credential. Your customer, merchant, order, or account stays an opaque external reference.')}
            </p>
            <ol>
              <li><span>1</span>{t('Create a tenant credential and explicit scopes.')}</li>
              <li><span>2</span>{t('Sign a canonical request and add an idempotency key.')}</li>
              <li><span>3</span>{t('Receive a tenant-isolated address.')}</li>
              <li><span>4</span>{t('Consume signed deposit and withdrawal events.')}</li>
            </ol>
          </div>
        </section>

        <section className="final-cta">
          <h2>{t('Ready to streamline your custody operations?')}</h2>
          <p>{t('Start building with Surprising Wallet today.')}</p>
          <div>
            <Link to="/console/login"><Button type="primary" size="large">{t('Open Console')}</Button></Link>
            <Link to="/console/developer-docs">
              <Button size="large">{t('Read API docs')}</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <Brand />
        <p>{t('Multi-tenant blockchain custody infrastructure.')}</p>
        <span>© 2026 Surprising Wallet</span>
      </footer>
    </div>
  );
}
