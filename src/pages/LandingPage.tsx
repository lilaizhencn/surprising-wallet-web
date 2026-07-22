import { Button } from 'antd';
import {
  ApiOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  GlobalOutlined,
  KeyOutlined,
  LinkOutlined,
  MailOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { AssetLogo, ChainLogo } from '../components/Web3Logo';
import { useI18n } from '../i18n';

const chains = [
  ['BTC', 'Bitcoin'], ['LTC', 'Litecoin'], ['DOGE', 'Dogecoin'], ['BCH', 'Bitcoin Cash'],
  ['ETH', 'Ethereum'], ['BNB', 'BNB Smart Chain'], ['POLYGON', 'Polygon'],
  ['ARBITRUM', 'Arbitrum'], ['OPTIMISM', 'Optimism'], ['BASE', 'Base'],
  ['AVAX_C', 'Avalanche C-Chain'], ['HYPEREVM', 'HyperEVM'], ['MANTLE', 'Mantle'],
  ['LINEA', 'Linea'], ['SCROLL', 'Scroll'], ['UNICHAIN', 'Unichain'],
  ['HYPERCORE', 'HyperCore'], ['TRON', 'TRON'], ['XRP', 'XRP Ledger'],
  ['SOLANA', 'Solana'], ['TON', 'TON'], ['APTOS', 'Aptos'], ['SUI', 'Sui'],
  ['ADA', 'Cardano'], ['DOT', 'Polkadot'], ['NEAR', 'NEAR'], ['XMR', 'Monero'],
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

const advantages = [
  {
    icon: <SafetyCertificateOutlined />,
    kicker: 'BITCOIN',
    title: 'Native SegWit multisig',
    body: 'Use native SegWit multisignature custody to reduce transaction weight and network fees while preserving independent authorization controls.',
  },
  {
    icon: <ThunderboltOutlined />,
    kicker: 'EVM · EIP-7702',
    title: 'Batch collection and sponsored gas',
    body: 'On supported EVM networks, EIP-7702 enables sponsored gas and multi-address batch collection without first funding every deposit address with native gas.',
  },
  {
    icon: <ApartmentOutlined />,
    kicker: 'ONE INFRASTRUCTURE',
    title: 'One system for every business line',
    body: 'Serve multiple products from one digital-asset foundation with explicit tenant, account, key, asset, permission, and audit boundaries.',
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
          <a href="#deployment">{t('Deployment')}</a>
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
            <span className="hero-eyebrow">{t('SaaS and private deployment')}</span>
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
            <div className="hero-proof">
              <span><CheckCircleFilled /> {t('Multi-tenant by design')}</span>
              <span><CheckCircleFilled /> {t('Chain-native security')}</span>
              <span><CheckCircleFilled /> {t('Technical support included')}</span>
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

        <section className="advantages-section" aria-labelledby="advantages-title">
          <div className="advantages-heading">
            <span>{t('Built into the wallet layer')}</span>
            <h2 id="advantages-title">{t('Chain-native efficiency. Enterprise-ready control.')}</h2>
            <p>{t('We optimize custody around how each network actually works, then expose it through one tenant-isolated operating model.')}</p>
          </div>
          <div className="advantages-grid">
            {advantages.map((item) => (
              <article key={item.title}>
                <div className="advantage-icon">{item.icon}</div>
                <small>{t(item.kicker)}</small>
                <h3>{t(item.title)}</h3>
                <p>{t(item.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="chains-section" id="chains">
          <div className="chains-heading">
            <span>{t('Multi-chain from day one')}</span>
            <h2>{t('All supported networks, one operating model')}</h2>
            <p>{t('Operate native assets and leading stablecoins through the same tenant-isolated API, Console, ledger, and audit path.')}</p>
          </div>
          <div className="chain-logo-grid">
            {chains.map(([chain, label]) => (
              <div className="chain-logo-item" key={chain}>
                <ChainLogo chain={chain} size={32} />
                <span><strong>{label}</strong><small>{chain}</small></span>
              </div>
            ))}
          </div>
          <div className="stablecoin-row">
            <span className="stablecoin-label">{t('Supported stablecoins')}</span>
            {['USDT', 'USDC'].map((symbol) => (
              <div key={symbol}>
                <AssetLogo symbol={symbol} size={34} />
                <span><strong>{symbol}</strong><small>{t('Multi-network token')}</small></span>
              </div>
            ))}
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
              ['IP allowlist', 'All API keys', 'Enforced'],
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
  "subject": "customer-8421",
  "addressVersion": 0
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
              <li><span>1</span>{t('Create a full-access tenant credential.')}</li>
              <li><span>2</span>{t('Sign a canonical request and add an idempotency key.')}</li>
              <li><span>3</span>{t('Receive a tenant-isolated address.')}</li>
              <li><span>4</span>{t('Consume signed deposit and withdrawal events.')}</li>
            </ol>
          </div>
        </section>

        <section className="deployment-section" id="deployment">
          <div className="deployment-heading">
            <span>{t('Choose how you operate')}</span>
            <h2>{t('Launch with SaaS. Own the stack with private deployment.')}</h2>
            <p>{t('Start quickly with a hosted tenant account, or deploy a dedicated wallet platform inside your own infrastructure.')}</p>
          </div>
          <div className="deployment-grid">
            <article className="deployment-card deployment-card--saas">
              <CloudServerOutlined />
              <small>SAAS</small>
              <h3>{t('Managed SaaS account')}</h3>
              <p>{t('Open an account and integrate through the Console and API without operating wallet infrastructure yourself.')}</p>
              <ul>
                <li><CheckCircleFilled /> {t('Fast onboarding and managed upgrades')}</li>
                <li><CheckCircleFilled /> {t('Tenant-isolated operations')}</li>
                <li><CheckCircleFilled /> {t('API, webhooks, audit, and reconciliation')}</li>
              </ul>
              <Link to="/console/login"><Button type="primary">{t('Open Console')}</Button></Link>
            </article>
            <article className="deployment-card deployment-card--private">
              <DeploymentUnitOutlined />
              <small>{t('PRIVATE DEPLOYMENT')}</small>
              <h3>{t('A shared foundation for all your product lines')}</h3>
              <p>{t('Run one dedicated system for multiple business lines while keeping their tenants, accounts, keys, assets, permissions, and audit trails clearly isolated.')}</p>
              <ul>
                <li><CheckCircleFilled /> {t('Deploy inside your controlled environment')}</li>
                <li><CheckCircleFilled /> {t('Avoid rebuilding wallets for every product')}</li>
                <li><CustomerServiceOutlined /> {t('Deployment and ongoing technical support included')}</li>
              </ul>
              <a href="mailto:business@tokdou.com"><Button>{t('Discuss private deployment')}</Button></a>
            </article>
          </div>
          <aside className="sales-contact" aria-label={t('Business contact')}>
            <div>
              <span>{t('Talk to our team')}</span>
              <strong>{t('Architecture, deployment, and integration support')}</strong>
            </div>
            <a href="mailto:business@tokdou.com"><MailOutlined /><span><small>{t('Business email')}</small>business@tokdou.com</span></a>
            <div className="sales-wechat"><MessageOutlined /><span><small>{t('WeChat')}</small>surprising_app</span></div>
          </aside>
        </section>

        <section className="final-cta">
          <h2>{t('One wallet foundation. Every product line.')}</h2>
          <p>{t('Choose SaaS for a fast start or contact us for a supported private deployment.')}</p>
          <div>
            <Link to="/console/login"><Button type="primary" size="large">{t('Open Console')}</Button></Link>
            <a href="mailto:business@tokdou.com"><Button size="large">{t('Contact sales')}</Button></a>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <Brand />
        <p>{t('Multi-tenant blockchain custody infrastructure.')}</p>
        <div className="footer-contact">
          <a href="mailto:business@tokdou.com">business@tokdou.com</a>
          <span>{t('WeChat')}: surprising_app</span>
        </div>
        <span>© 2026 Surprising Wallet</span>
      </footer>
    </div>
  );
}
