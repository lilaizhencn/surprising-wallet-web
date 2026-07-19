import { render, screen } from '@testing-library/react';
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
      if (!path.startsWith('/custody/platform/v1/tenants')) {
        throw new Error(`Unhandled Platform request: ${path}`);
      }
      return jsonResponse([{
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
        createdAt: timestamp,
        updatedAt: timestamp,
      }]);
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
});
