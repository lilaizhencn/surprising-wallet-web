import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function signIn() {
  saveSession({
    version: 1,
    accountType: 'tenant',
    token: 'cs_workflow-test-session',
    expiresAt: '2099-01-01T00:00:00Z',
    userId: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    tenantSlug: 'workflow-tenant',
    email: 'admin@workflow.test',
    displayName: 'Workflow Admin',
    role: 'TENANT_ADMIN',
  });
}

const customerAddress = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  chain: 'ETH',
  network: 'sepolia',
  address: '0x1111111111111111111111111111111111111111',
  externalReference: 'customer-42',
  label: 'Customer 42',
  metadata: {},
  source: 'API',
  status: 'ACTIVE',
  createdAt: '2026-07-20T00:00:00Z',
};

const gasAccount = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  custodyAddressId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  chain: 'ETH',
  network: 'sepolia',
  nativeSymbol: 'ETH',
  address: '0x3333333333333333333333333333333333333333',
  availableBalance: 2.5,
  lockedBalance: 0.1,
  totalBalance: 2.6,
  lowBalanceThreshold: 0.05,
  lowBalance: false,
  status: 'ACTIVE',
  createdAt: '2026-07-20T00:00:00Z',
  updatedAt: '2026-07-20T00:00:00Z',
};

describe('custody operator workflows', () => {
  beforeEach(() => {
    clearSession();
    signIn();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it('requires a second withdrawal confirmation and sends confirmed=true', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push({ path, init });
      if (path.startsWith('/custody/console/v1/withdrawals') && init?.method === 'POST') {
        return response({ id: 'withdrawal-1', status: 'FROZEN' }, 201);
      }
      if (path.startsWith('/custody/console/v1/withdrawals')) return response([]);
      if (path.startsWith('/custody/console/v1/addresses')) return response([customerAddress]);
      if (path.startsWith('/custody/console/v1/gas-accounts')) return response([gasAccount]);
      throw new Error(`Unhandled request: ${path}`);
    }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/console/withdrawals']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Withdrawals' }, { timeout: 15_000 });
    await user.click(screen.getByRole('button', { name: /Create withdrawal/ }));
    await user.click(screen.getByRole('combobox', { name: 'Source custody address' }));
    await user.click(await screen.findByText(/Customer 42/));
    await user.type(screen.getByRole('textbox', { name: 'Asset' }), 'ETH');
    await user.type(
      screen.getByRole('textbox', { name: 'Destination address' }),
      '0x2222222222222222222222222222222222222222',
    );
    await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), '0.25');
    await user.click(screen.getByRole('button', { name: 'Review withdrawal' }));

    expect(screen.getByText('Confirm withdrawal')).toBeInTheDocument();
    expect(requests.filter((item) => item.init?.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirm and freeze funds' }));

    await screen.findByText(/asset and network-fee reserves are frozen/i);
    const create = requests.find((item) => item.init?.method === 'POST');
    expect(create?.path).toBe('/custody/console/v1/withdrawals');
    expect(JSON.parse(String(create?.init?.body))).toMatchObject({
      custodyAddressId: customerAddress.id,
      chain: 'ETH',
      assetSymbol: 'ETH',
      amount: '0.25',
      confirmed: true,
    });
  }, 60_000);

  it('shows immutable webhook attempts and manually queues a new retry cycle', async () => {
    const retryRequests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/custody/console/v1/webhooks') {
        return response([{
          id: 'endpoint-1',
          name: 'Production events',
          url: 'https://example.test/hooks',
          events: ['DEPOSIT.CONFIRMED'],
          status: 'ACTIVE',
          successRate24h: 80,
        }]);
      }
      if (path.startsWith('/custody/console/v1/webhook-deliveries/delivery-1/attempts')) {
        return response([{
          id: 'attempt-2',
          attemptNumber: 2,
          retryCycle: 1,
          trigger: 'MANUAL',
          status: 'FAILED',
          httpStatus: 503,
          errorMessage: 'upstream unavailable',
          startedAt: '2026-07-20T00:00:00Z',
          completedAt: '2026-07-20T00:00:00Z',
          durationMs: 47,
        }]);
      }
      if (path.endsWith('/delivery-1/retry') && init?.method === 'POST') {
        retryRequests.push(path);
        return response({ ok: true });
      }
      if (path.startsWith('/custody/console/v1/webhook-deliveries')) {
        return response([{
          id: 'delivery-1',
          eventId: 'event-1',
          eventType: 'DEPOSIT.CONFIRMED',
          status: 'FAILED',
          attemptCount: 10,
          totalAttemptCount: 12,
          manualRetryCount: 1,
          lastHttpStatus: 503,
          lastError: 'upstream unavailable',
          createdAt: '2026-07-20T00:00:00Z',
        }]);
      }
      throw new Error(`Unhandled request: ${path}`);
    }));

    render(
      <MemoryRouter initialEntries={['/console/webhooks']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Webhooks' }, { timeout: 15_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Deliveries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }, { timeout: 10_000 }));
    const detailsTitle = await screen.findByText('Webhook delivery details');
    const details = detailsTitle.closest<HTMLElement>('.ant-modal');
    expect(details).not.toBeNull();
    if (!details) throw new Error('Webhook delivery details modal was not rendered');
    expect(await within(details).findByText('MANUAL')).toBeInTheDocument();
    expect(within(details).getByText('47 ms')).toBeInTheDocument();
    const closeButtons = within(details).getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: /Retry now/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    await screen.findByText('Delivery queued for retry');
    expect(retryRequests).toEqual([
      '/custody/console/v1/webhook-deliveries/delivery-1/retry',
    ]);
  }, 60_000);

  it('shows confirmed funding and auditable gas fee settlement history', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/topups?limit=100')) {
        return response([{
          id: 'topup-1',
          chain: 'ETH',
          assetSymbol: 'ETH',
          txHash: '0xtopup',
          amount: 3,
          status: 'CONFIRMED',
          creditedAt: '2026-07-20T00:00:00Z',
          createdAt: '2026-07-20T00:00:00Z',
        }]);
      }
      if (path.endsWith('/usage?limit=100')) {
        return response([{
          id: 'usage-1',
          custodyWithdrawalId: 'withdrawal-1',
          orderNo: 'CW-workflow-1',
          chain: 'ETH',
          nativeSymbol: 'ETH',
          reservedAmount: 0.001,
          actualAmount: 0.00042,
          status: 'SETTLED',
          pricingSource: 'CHAIN_CONFIRMED',
          txHash: '0xwithdrawal',
          createdAt: '2026-07-20T00:00:00Z',
          settledAt: '2026-07-20T00:01:00Z',
        }]);
      }
      if (path === '/custody/console/v1/gas-accounts') return response([gasAccount]);
      throw new Error(`Unhandled request: ${path}`);
    }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/console/gas-station']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Gas station' }, { timeout: 15_000 });
    await user.click(await screen.findByRole('button', { name: /Manage/ }, { timeout: 10_000 }));
    expect(await screen.findByText('Funding history')).toBeInTheDocument();
    expect(await screen.findByText('Network fee usage')).toBeInTheDocument();
    expect(await screen.findByText('CW-workflow-1')).toBeInTheDocument();
    expect(screen.getByText('CHAIN CONFIRMED')).toBeInTheDocument();
    expect(screen.getAllByText(/SETTLED/).length).toBeGreaterThan(0);
  }, 60_000);
});
