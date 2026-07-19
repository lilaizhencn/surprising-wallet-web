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

const apiDocsUrl =
  'https://github.com/lilaizhencn/surprising-wallet/blob/master/docs/openapi/custody-v1.yaml';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="marketing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#chains">Chains</a>
          <a href="#security">Security</a>
          <a href="#developers">Developers</a>
        </nav>
        <Link to="/console/login">
          <Button>Sign in</Button>
        </Link>
      </header>

      <main>
        <section className="hero-section" id="product">
          <div className="hero-copy">
            <h1>Blockchain infrastructure for every product you build</h1>
            <p>
              Create deposit addresses, orchestrate secure withdrawals, and operate
              tenant assets from one custody platform.
            </p>
            <div className="hero-actions">
              <Link to="/console/login">
                <Button type="primary" size="large">
                  Open Console <ArrowRightOutlined />
                </Button>
              </Link>
              <a href={apiDocsUrl} target="_blank" rel="noreferrer">
                <Button size="large">Read API docs <CodeOutlined /></Button>
              </a>
            </div>
          </div>
          <div className="hero-console" aria-label="Custody address workflow preview">
            <div className="preview-topbar">
              <Brand compact />
              <span>Acme Pay</span>
              <span className="preview-environment">Production</span>
            </div>
            <div className="preview-body">
              <aside>
                <strong>Overview</strong>
                <span className="active">Addresses</span>
                <span>Deposits</span>
                <span>Withdrawals</span>
                <span>Webhooks</span>
              </aside>
              <div className="preview-main">
                <div className="preview-title">
                  <div>
                    <strong>Addresses</strong>
                    <small>Tenant-isolated deposit addresses</small>
                  </div>
                  <span className="preview-create">Create address</span>
                </div>
                <div className="preview-table">
                  <div className="preview-row preview-head">
                    <span>Address</span><span>Network</span><span>Source</span><span>Status</span>
                  </div>
                  {[
                    ['0x8a7f…c9e2', 'Ethereum', 'API'],
                    ['bc1q4…7a8c', 'Bitcoin', 'Console'],
                    ['7Gd59…pP3k', 'Solana', 'API'],
                  ].map((row) => (
                    <div className="preview-row" key={row[0]}>
                      <span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span>
                      <span className="preview-status"><i /> Active</span>
                    </div>
                  ))}
                </div>
                <div className="preview-route">
                  <span><CheckCircleFilled /> Deposit received</span>
                  <i />
                  <span><CheckCircleFilled /> Confirmed</span>
                  <i />
                  <span><CheckCircleFilled /> Tenant credited</span>
                  <i className="pending" />
                  <span>Webhook</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-heading">
            <h2>One custody layer, many businesses</h2>
            <p>
              Isolate tenants, streamline operations, and trace addresses, deposits,
              withdrawals, and signed webhooks end to end.
            </p>
          </div>
          <div className="workflow-line">
            {workflow.map((item, index) => (
              <article key={item.title}>
                <div className="workflow-icon">{item.icon}</div>
                <span className="workflow-number">{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="chains-section" id="chains">
          <h2>Built for multi-chain operations</h2>
          <div className="chain-rail">
            {chains.map((chain) => <span key={chain}>{chain}</span>)}
          </div>
        </section>

        <section className="security-section" id="security">
          <div className="security-copy">
            <h2>Control every sensitive action</h2>
            <p>
              Security boundaries are enforced before an operation reaches chain
              orchestration or tenant funds.
            </p>
            <ul>
              <li><KeyOutlined /><span><strong>API request signing</strong>HMAC signatures, timestamp windows, and replay protection.</span></li>
              <li><SafetyCertificateOutlined /><span><strong>IP allowlists</strong>Restrict service credentials to explicit IPv4 or IPv6 networks.</span></li>
              <li><AuditOutlined /><span><strong>Complete audit path</strong>Searchable tenant, credential, address, and delivery changes.</span></li>
              <li><LinkOutlined /><span><strong>Reliable webhook delivery</strong>Exponential retry, delivery history, and manual replay.</span></li>
            </ul>
          </div>
          <div className="security-ledger">
            <div className="ledger-heading">
              <strong>Operational controls</strong>
              <span>Live</span>
            </div>
            <div className="ledger-row ledger-labels">
              <span>Control</span><span>Enforcement</span><span>State</span>
            </div>
            {[
              ['Request signature', 'Before routing', 'Enforced'],
              ['IP allowlist', 'Credential scope', 'Enforced'],
              ['Tenant isolation', 'Every query', 'Enforced'],
              ['Event uniqueness', 'Database constraint', 'Enforced'],
            ].map((row) => (
              <div className="ledger-row" key={row[0]}>
                <span>{row[0]}</span><span>{row[1]}</span>
                <span className="preview-status"><i />{row[2]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="developers-section" id="developers">
          <div className="developer-code">
            <div className="code-tabs"><span className="active">Create address</span><span>Webhook verification</span></div>
            <pre>
              <code>{`POST /custody/api/v1/addresses
Idempotency-Key: customer-8421-ethereum
X-Custody-Key: swk_...
X-Custody-Timestamp: 1784486400
X-Custody-Nonce: 2FSvJwQp1QdwLk2B
X-Custody-Signature: ...

{
  "chain": "ETH",
  "externalReference": "customer-8421",
  "label": "Primary deposit address"
}`}</code>
            </pre>
          </div>
          <div className="developer-copy">
            <ApiOutlined />
            <h2>Integrate once. Keep building.</h2>
            <p>
              Tenant identity comes from the credential. Your customer, merchant,
              order, or account stays an opaque external reference.
            </p>
            <ol>
              <li><span>1</span>Create a tenant credential and explicit scopes.</li>
              <li><span>2</span>Sign a canonical request and add an idempotency key.</li>
              <li><span>3</span>Receive a tenant-isolated address.</li>
              <li><span>4</span>Consume signed deposit and withdrawal events.</li>
            </ol>
          </div>
        </section>

        <section className="final-cta">
          <h2>Ready to streamline your custody operations?</h2>
          <p>Start building with Surprising Wallet today.</p>
          <div>
            <Link to="/console/login"><Button type="primary" size="large">Open Console</Button></Link>
            <a href={apiDocsUrl} target="_blank" rel="noreferrer">
              <Button size="large">Read API docs</Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <Brand />
        <p>Multi-tenant blockchain custody infrastructure.</p>
        <span>© 2026 Surprising Wallet</span>
      </footer>
    </div>
  );
}
