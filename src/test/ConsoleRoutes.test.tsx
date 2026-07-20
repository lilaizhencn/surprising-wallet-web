import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function tenantSession() {
  saveSession({
    version: 1,
    accountType: 'tenant',
    token: 'cs_console-route-test-session-token',
    expiresAt: '2099-01-01T00:00:00Z',
    userId: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    tenantSlug: 'acme-pay',
    email: 'admin@acme.test',
    displayName: 'Acme Admin',
    role: 'TENANT_ADMIN',
  });
}

function platformSession() {
  saveSession({
    version: 1,
    accountType: 'platform',
    token: 'cs_platform-route-test-session-token',
    expiresAt: '2099-01-01T00:00:00Z',
    userId: '33333333-3333-3333-3333-333333333333',
    email: 'platform@custody.test',
    displayName: 'Platform Admin',
    role: 'PLATFORM_ADMIN',
  });
}

const timestamp = '2026-07-20T00:00:00Z';

function installConsoleApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith('/custody/console/v1/assets')) {
      return jsonResponse([{
        chain: 'ETH',
        assetSymbol: 'ETH',
        availableBalance: 12.5,
        lockedBalance: 0,
        totalBalance: 12.5,
        addressCount: 2,
      }]);
    }
    if (path.startsWith('/custody/console/v1/onboarding')) {
      return jsonResponse({
        apiKeyConfigured: true,
        webhookConfigured: true,
        ipAllowlistConfigured: true,
        addressCreated: true,
        gasAccountConfigured: true,
        gasAccountFunded: true,
        completedSteps: 6,
        totalSteps: 6,
        ready: true,
      });
    }
    if (path.startsWith('/custody/console/v1/gas-accounts')) {
      return jsonResponse([{
        id: '12121212-1212-1212-1212-121212121212',
        custodyAddressId: '13131313-1313-1313-1313-131313131313',
        chain: 'ETH',
        network: 'sepolia',
        nativeSymbol: 'ETH',
        address: '0x3333333333333333333333333333333333333333',
        availableBalance: 2.5,
        lockedBalance: 0,
        totalBalance: 2.5,
        lowBalanceThreshold: 0.05,
        lowBalance: false,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/addresses')) {
      return jsonResponse([{
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        chain: 'ETH',
        network: 'sepolia',
        address: '0x1111111111111111111111111111111111111111',
        externalReference: 'user_10086',
        label: 'Primary deposit',
        metadata: {},
        source: 'API',
        status: 'ACTIVE',
        createdAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/deposits')) {
      return jsonResponse([{
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        custodyAddressId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        externalReference: 'user_10086',
        chain: 'ETH',
        assetSymbol: 'ETH',
        txHash: '0xdeposit',
        logIndex: 0,
        amount: 12.5,
        status: 'CONFIRMED',
        creditedAt: timestamp,
        createdAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/withdrawals')) {
      return jsonResponse([{
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        custodyAddressId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        orderNo: 'CW-acme-1',
        externalReference: 'merchant-order-1',
        chain: 'ETH',
        assetSymbol: 'ETH',
        toAddress: '0x2222222222222222222222222222222222222222',
        amount: 1,
        fee: 0.01,
        status: 'CONFIRMED',
        txHash: '0xwithdrawal',
        createdAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/webhook-deliveries')) {
      return jsonResponse([]);
    }
    if (path.startsWith('/custody/console/v1/webhooks')) {
      return jsonResponse([{
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        name: 'Production events',
        url: 'https://example.test/custody-events',
        events: ['DEPOSIT.CONFIRMED'],
        status: 'ACTIVE',
        successRate24h: 100,
        lastDeliveryAt: timestamp,
        createdAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/api-keys')) {
      return jsonResponse([{
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        keyId: 'swk_route_test',
        name: 'Backend service',
        scopes: ['addresses:read'],
        status: 'ACTIVE',
        createdAt: timestamp,
      }]);
    }
    if (path.startsWith('/custody/console/v1/ip-allowlist')) {
      return jsonResponse({
        enabled: true,
        rules: [{
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          label: 'Production NAT',
          cidr: '203.0.113.20/32',
          enabled: true,
          createdAt: timestamp,
        }],
      });
    }
    if (path.startsWith('/custody/console/v1/audit-log')) {
      return jsonResponse([{
        id: '99999999-9999-9999-9999-999999999999',
        actorType: 'TENANT_USER',
        actorId: '11111111-1111-1111-1111-111111111111',
        action: 'ADDRESS.CREATE',
        resourceType: 'CUSTODY_ADDRESS',
        resourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sourceIp: '203.0.113.20',
        details: '{}',
        createdAt: timestamp,
      }]);
    }
    throw new Error(`Unhandled Console request: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('tenant Console routes', () => {
  beforeEach(() => {
    clearSession();
    tenantSession();
    installConsoleApi();
  });
  afterEach(() => clearSession());

  it.each([
    ['/console/overview', 'Asset overview', '12.5 ETH'],
    ['/console/assets', 'Assets', '12.5 ETH'],
    ['/console/gas-station', 'Gas station', '2.5 ETH'],
    ['/console/addresses', 'Addresses', 'user_10086'],
    ['/console/deposits', 'Deposits', 'user_10086'],
    ['/console/withdrawals', 'Withdrawals', 'merchant-order-1'],
    ['/console/webhooks', 'Webhooks', 'Production events'],
    ['/console/api-access', 'API access', 'Backend service'],
    ['/console/audit-log', 'Audit log', 'ADDRESS.CREATE'],
  ])('renders %s with live API-shaped data', async (route, heading, record) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: heading, level: 1 }))
      .toBeInTheDocument();
    expect((await screen.findAllByText(record)).length).toBeGreaterThan(0);
  }, 15_000);
});

describe('platform Console route', () => {
  beforeEach(() => {
    clearSession();
    platformSession();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/custody/platform/v1/wallet-config/keyset') {
        return jsonResponse({
          configured: true,
          locked: true,
          sig1Seed: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          sig2Seed: 'AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          recoverySeed: 'AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          ed25519Seed: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          updatedAt: timestamp,
          updatedBy: '33333333-3333-3333-3333-333333333333',
        });
      }
      if (path === '/custody/platform/v1/wallet-config/summary') {
        return jsonResponse({
          environment: 'test2',
          production: false,
          keysetConfigured: true,
          globalSwitches: {
            walletEnabled: true,
            scanEnabled: true,
            withdrawEnabled: true,
            collectionEnabled: false,
            transferEnabled: true,
          },
          statistics: {
            configuredChainProfileCount: 2,
            enabledChainCount: 1,
            enabledNetworkCount: 2,
            enabledTokenCount: 2,
            enabledRpcNodeCount: 2,
            anomalyCount: 1,
          },
          chains: [{
            profileId: 1,
            chain: 'ETH',
            network: 'devnet',
            family: 'evm',
            configuredEnabled: true,
            configuredTasks: {
              scanEnabled: true,
              withdrawEnabled: true,
              collectionEnabled: true,
              transferEnabled: true,
            },
            effectiveTasks: {
              scanEnabled: true,
              withdrawEnabled: true,
              collectionEnabled: false,
              transferEnabled: true,
            },
            enabledTokenCount: 2,
            enabledRpcNodeCount: 1,
            status: 'BLOCKED',
            blockers: ['Global collection switch is off.'],
          }],
          anomalies: [{
            code: 'TOKEN_NETWORK_MISSING',
            severity: 'WARNING',
            chain: 'ETH',
            message: 'USDC does not declare its network.',
          }],
          generatedAt: timestamp,
        });
      }
      const chain = {
        id: 1,
        chain: 'ETH',
        network: 'devnet',
        family: 'EVM',
        runtimeCurrencyId: 60,
        bip44CoinType: 60,
        nativeSymbol: 'ETH',
        explorerUrl: null,
        depositConfirmations: 2,
        withdrawConfirmations: 2,
        defaultFeeRate: null,
        dustThreshold: null,
        enabled: true,
        chainId: 31337,
        gasPolicy: null,
        scanBatchSize: 100,
        scanEnabled: true,
        withdrawEnabled: true,
        collectionEnabled: false,
        transferEnabled: true,
        scanStartHeight: 0,
        scanMaxBlocksPerRun: 100,
        tokenSymbols: ['USDT'],
        tokenCount: 1,
        rpcCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const token = {
        id: 4,
        chain: 'ETH',
        network: 'devnet',
        symbol: 'USDT',
        standard: 'ERC20',
        contractAddress: '0x1111111111111111111111111111111111111111',
        decimals: 6,
        enabled: true,
        collectEnabled: true,
        assetActive: true,
        chainEnabled: true,
        effectiveEnabled: true,
        blockers: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      if (path === '/custody/platform/v1/wallet-config/chains') {
        return jsonResponse([
          chain,
          {
            ...chain,
            id: 2,
            network: 'mainnet',
            chainId: 1,
            enabled: false,
            scanEnabled: false,
            withdrawEnabled: false,
            collectionEnabled: false,
            transferEnabled: false,
            tokenSymbols: ['USDC'],
            rpcCount: 0,
          },
        ]);
      }
      if (path === '/custody/platform/v1/wallet-config/chains/1') {
        return jsonResponse({
          chain,
          rpcNodes: [{
            id: 3,
            environment: 'test2',
            nodeLabel: 'Local Hardhat',
            purpose: 'rpc',
            connectionType: 'HTTP_JSON_RPC',
            rpcUrl: 'http://127.0.0.1:8545',
            authType: 'NONE',
            apiKeyConfigured: false,
            usernameConfigured: false,
            passwordConfigured: false,
            priority: 10,
            minRequestIntervalMs: 0,
            enabled: true,
            lastCheckedAt: timestamp,
            lastLatencyMs: 15,
            lastHttpStatus: 200,
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          tokens: [token],
          checks: [],
          production: false,
          environment: 'test2',
        });
      }
      if (path.startsWith('/custody/platform/v1/wallet-config/audit-log')) {
        return jsonResponse([{
          id: '99999999-9999-9999-9999-999999999999',
          actorType: 'PLATFORM_USER',
          actorId: '33333333-3333-3333-3333-333333333333',
          action: 'WALLET_RPC.UPDATE',
          resourceType: 'CHAIN_RPC_NODE',
          resourceId: '3',
          details: '{}',
          createdAt: timestamp,
        }]);
      }
      if (!path.startsWith('/custody/platform/v1/tenants')) {
        throw new Error(`Unhandled Platform request: ${path}`);
      }
      const tenant = {
        id: '22222222-2222-2222-2222-222222222222',
        slug: 'acme-pay',
        name: 'Acme Pay',
        status: 'ACTIVE',
        derivationNamespace: 1000,
        ipAllowlistEnabled: true,
        displayCurrency: 'USD',
        addressCount: 2,
        depositCount: 1,
        withdrawalCount: 1,
        activeWebhookCount: 1,
        activeApiKeyCount: 1,
        gasAccountCount: 1,
        failedWebhookDeliveryCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      if (path === `/custody/platform/v1/tenants/${tenant.id}`) {
        return jsonResponse({
          tenant,
          statistics: {
            addressCount: 2,
            depositCount: 1,
            withdrawalCount: 1,
            activeWebhookCount: 1,
            activeApiKeyCount: 1,
            gasAccountCount: 1,
            failedWebhookDeliveryCount: 0,
            userCount: 1,
            activeSessionCount: 1,
          },
          onboarding: {
            apiKeyConfigured: true,
            webhookConfigured: true,
            ipAllowlistConfigured: true,
            addressCreated: true,
            gasAccountConfigured: true,
            gasAccountFunded: true,
            completedSteps: 6,
            totalSteps: 6,
            ready: true,
          },
          administrators: [{
            id: '33333333-3333-3333-3333-333333333333',
            email: 'admin@acme.test',
            displayName: 'Acme Admin',
            role: 'TENANT_ADMIN',
            status: 'ACTIVE',
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
          assets: [{
            chain: 'ETH',
            assetSymbol: 'USDT',
            availableBalance: '1250',
            lockedBalance: '25',
            totalBalance: '1275',
            addressCount: 2,
          }],
          recentAddresses: [],
          gasAccounts: [],
          apiKeys: [],
          ipRules: [],
          webhooks: [],
          webhookDeliveries: [],
          recentDeposits: [],
          recentWithdrawals: [],
          recentAudit: [],
        });
      }
      return jsonResponse({
        items: [tenant],
        total: 1,
        limit: 20,
        offset: 0,
      });
    }));
  });
  afterEach(() => clearSession());

  it('renders tenant management with platform-scoped data', async () => {
    render(
      <MemoryRouter initialEntries={['/platform/tenants']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Tenants', level: 1 }))
      .toBeInTheDocument();
    expect(await screen.findByText('Acme Pay')).toBeInTheDocument();
  }, 15_000);

  it('renders the complete platform tenant detail route', async () => {
    render(
      <MemoryRouter initialEntries={[
        '/platform/tenants/22222222-2222-2222-2222-222222222222',
      ]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole(
      'heading',
      { name: 'Acme Pay', level: 1 },
      { timeout: 15_000 },
    ))
      .toBeInTheDocument();
    expect(await screen.findByText('Acme Admin')).toBeInTheDocument();
    expect(await screen.findByText('1,250')).toBeInTheDocument();
    expect(await screen.findByText('Integration readiness')).toBeInTheDocument();
  }, 15_000);

  it('keeps a locked wallet keyset viewable but not editable', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/platform/wallet-keys']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Wallet keys', level: 1 }))
      .toBeInTheDocument();
    expect(await screen.findByText('Configured')).toBeInTheDocument();
    const sig1Seed = screen.getByLabelText('Sig1 BIP32 Seed');
    expect(sig1Seed).toHaveAttribute('readonly');
    expect(sig1Seed).toHaveAttribute('type', 'password');
    await user.click(screen.getAllByRole('img', { name: 'eye-invisible' })[0]);
    expect(sig1Seed).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /Save all four seeds/ })).toBeDisabled();
  }, 15_000);

  it('renders wallet configuration health and effective runtime state', async () => {
    render(
      <MemoryRouter initialEntries={['/platform/wallet-config']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Wallet configuration', level: 1 }))
      .toBeInTheDocument();
    expect(await screen.findByText('test2 environment')).toBeInTheDocument();
    expect((await screen.findAllByText('ETH')).length).toBeGreaterThan(0);
    expect(await screen.findByText('USDC does not declare its network.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save switches/ })).toBeDisabled();
  }, 15_000);

  it('groups network profiles into one chain row with token logos and symbols', async () => {
    render(<MemoryRouter initialEntries={['/platform/wallet-config/chains']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Chains & Tokens', level: 1 }))
      .toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getAllByText('devnet')).toHaveLength(2);
    expect(within(table).getByText('mainnet')).toBeInTheDocument();
    expect(within(table).getByText('USDT')).toBeInTheDocument();
    expect(within(table).getByText('USDC')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Chains & Tokens$/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^Tokens$/ })).not.toBeInTheDocument();
  }, 15_000);

  it.each([
    ['/platform/wallet-config/chains', 'Chains & Tokens', 'devnet'],
    ['/platform/wallet-config/chains/1', 'ETH', 'Local Hardhat'],
    ['/platform/wallet-config/tokens', 'Chains & Tokens', 'USDT'],
    ['/platform/wallet-config/audit-log', 'Wallet configuration audit', 'WALLET_RPC.UPDATE'],
  ])('renders %s from platform wallet APIs', async (route, heading, record) => {
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
    expect((await screen.findAllByText(record)).length).toBeGreaterThan(0);
  }, 15_000);
});
