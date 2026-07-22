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
    version: 2,
    accountType: 'tenant',
    expiresAt: '2099-01-01T00:00:00Z',
    userId: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    tenantSlug: 'workflow-tenant',
    email: 'admin@workflow.test',
    displayName: 'Workflow Admin',
    role: 'TENANT_ADMIN',
    scopes: ['*'],
  });
}

const customerAddress = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  chain: 'ETH',
  network: 'sepolia',
  address: '0x1111111111111111111111111111111111111111',
  subject: 'customer-42',
  addressVersion: 0,
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

  it('submits a tenant wrong-chain recovery request with auditable transaction fields', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/custody/console/v1/asset-recoveries' && init?.method === 'POST') {
        return response({
          id: 'recovery-1', tenantId: '22222222-2222-2222-2222-222222222222',
          actualChain: 'ARBITRUM', expectedChain: 'ETH', assetSymbol: 'USDT',
          txHash: '0xwrongchain', logIndex: 0,
          destinationAddress: customerAddress.address, verifiedAmount: '25',
          confirmations: 32, status: 'VERIFIED',
          createdAt: customerAddress.createdAt, updatedAt: customerAddress.createdAt,
        });
      }
      if (path.startsWith('/custody/console/v1/asset-recoveries')) return response([]);
      throw new Error(`Unhandled request: ${path}`);
    }));

    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/console/asset-recoveries']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Asset recovery', level: 1 });
    await user.click(screen.getByRole('button', { name: /Submit recovery request/ }));
    await user.click(screen.getByRole('combobox', { name: 'Actual chain' }));
    await user.click(await screen.findByText('ARBITRUM'));
    await user.type(screen.getByRole('textbox', { name: 'Asset symbol' }), 'USDT');
    await user.type(screen.getByRole('textbox', { name: 'Transaction hash' }), '0xwrongchain');
    await user.type(screen.getByRole('textbox', { name: 'System destination address' }), customerAddress.address);
    await user.click(screen.getByRole('button', { name: 'OK' }));

    await screen.findByText(/verified and is waiting for platform approval/i);
    const create = requests.find((item) => item.init?.method === 'POST');
    expect(create?.path).toBe('/custody/console/v1/asset-recoveries');
    expect(JSON.parse(String(create?.init?.body))).toMatchObject({
      actualChain: 'ARBITRUM', assetSymbol: 'USDT', txHash: '0xwrongchain',
      destinationAddress: customerAddress.address,
    });
  }, 60_000);

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
    await user.type(screen.getByPlaceholderText('USDT'), 'ETH');
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

  it('creates a rotated customer address with the tenant-managed version', async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/custody/console/v1/addresses' && init?.method === 'POST') {
        return response({
          ...customerAddress,
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          addressVersion: 2,
        });
      }
      if (path.startsWith('/custody/console/v1/addresses')) return response([]);
      throw new Error(`Unhandled request: ${path}`);
    }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/console/addresses']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Addresses' }, { timeout: 15_000 });
    await user.click(screen.getByRole('button', { name: /Create address/ }));
    const drawerTitle = await screen.findByText('Create address', {
      selector: '.ant-drawer-title',
    });
    const drawer = drawerTitle.closest<HTMLElement>('.ant-drawer');
    expect(drawer).not.toBeNull();
    if (!drawer) throw new Error('Create address drawer was not rendered');
    await user.type(within(drawer).getByRole('combobox', { name: 'Network' }), 'ETH');
    await user.type(within(drawer).getByRole('textbox', { name: 'Subject' }), 'customer-42');
    const version = within(drawer).getByRole('spinbutton', { name: 'Address version' });
    await user.clear(version);
    await user.type(version, '2');
    await user.click(within(drawer).getByRole('button', { name: 'Create deposit address' }));

    await screen.findByText('Deposit address created');
    const create = requests.find((item) => item.path === '/custody/console/v1/addresses'
      && item.init?.method === 'POST');
    expect(JSON.parse(String(create?.init?.body))).toMatchObject({
      chain: 'ETH',
      subject: 'customer-42',
      addressVersion: 2,
    });
  }, 60_000);

  it('shows full custody addresses and applies address filters only when searched', async () => {
    const addressQueries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith('/custody/console/v1/addresses')) {
        addressQueries.push(path);
        return response([customerAddress]);
      }
      throw new Error(`Unhandled request: ${path}`);
    }));

    render(<MemoryRouter initialEntries={['/console/addresses']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Addresses', level: 1 }, { timeout: 15_000 });
    await Promise.resolve();
    await Promise.resolve();
    const manageButton = screen.getByText('Manage').closest('button');
    expect(manageButton).not.toBeNull();
    if (!manageButton) throw new Error('Manage address button was not rendered');
    expect(screen.getByText(customerAddress.address)).toBeInTheDocument();
    fireEvent.click(manageButton);
    const managerTitle = screen.getByText('Manage address', { selector: '.ant-drawer-title' });
    const manager = managerTitle.closest<HTMLElement>('.ant-drawer');
    expect(manager).not.toBeNull();
    if (!manager) throw new Error('Manage address drawer was not rendered');
    expect(within(manager).getByText(customerAddress.address)).toBeInTheDocument();
    fireEvent.click(within(manager).getByRole('button', { name: 'Cancel' }));

    fireEvent.change(screen.getByLabelText('Search address or subject'), {
      target: { value: 'customer-42' },
    });
    expect(addressQueries).toHaveLength(1);
    fireEvent.click(screen.getByText('Search'));

    await vi.waitFor(() => expect(addressQueries.some((path) =>
      path.includes('search=customer-42'))).toBe(true));
    fireEvent.click(screen.getByText('Reset'));
    await vi.waitFor(() => expect(addressQueries.filter((path) =>
      path === '/custody/console/v1/addresses?limit=100')).toHaveLength(2));
  }, 60_000);

  it('shows full deposit addresses and sends all deposit filters', async () => {
    const depositQueries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith('/custody/console/v1/deposits')) {
        depositQueries.push(path);
        return response([{
          id: 'deposit-1', custodyAddressId: customerAddress.id,
          address: customerAddress.address, subject: customerAddress.subject,
          chain: 'ETH', assetSymbol: 'USDT', txHash: '0xdeposit-filter', logIndex: 0,
          amount: '12.5', status: 'CONFIRMED', creditedAt: customerAddress.createdAt,
          createdAt: customerAddress.createdAt,
        }]);
      }
      throw new Error(`Unhandled request: ${path}`);
    }));

    render(<MemoryRouter initialEntries={['/console/deposits']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Deposits', level: 1 }, { timeout: 15_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByText('0xdeposit-filter')).toBeInTheDocument();
    expect(screen.getByText(customerAddress.address)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'usdt' } });
    fireEvent.change(screen.getByLabelText('Search deposits'), {
      target: { value: 'customer-42' },
    });
    expect(depositQueries).toHaveLength(1);
    fireEvent.click(screen.getByText('Search'));

    await vi.waitFor(() => expect(depositQueries.some((path) =>
      path.includes('assetSymbol=USDT')
      && path.includes('search=customer-42'))).toBe(true));
  }, 60_000);

  it('shows full withdrawal source and destination addresses and filters withdrawals', async () => {
    const withdrawalQueries: string[] = [];
    const destination = '0x2222222222222222222222222222222222222222';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.startsWith('/custody/console/v1/withdrawals')) {
        withdrawalQueries.push(path);
        return response([{
          id: 'withdrawal-1', custodyAddressId: customerAddress.id,
          sourceAddress: customerAddress.address, subject: customerAddress.subject,
          orderNo: 'CW-FILTER-1', externalReference: 'payout-alpha', chain: 'ETH',
          assetSymbol: 'USDT', toAddress: destination, amount: '3.5', fee: '0.1',
          txHash: '0xwithdrawal-filter', status: 'CONFIRMED', createdAt: customerAddress.createdAt,
        }]);
      }
      if (path.startsWith('/custody/console/v1/addresses')) return response([customerAddress]);
      if (path.startsWith('/custody/console/v1/gas-accounts')) return response([gasAccount]);
      throw new Error(`Unhandled request: ${path}`);
    }));

    render(<MemoryRouter initialEntries={['/console/withdrawals']}><App /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Withdrawals', level: 1 }, { timeout: 15_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByText('payout-alpha')).toBeInTheDocument();
    expect(screen.getByText(customerAddress.address)).toBeInTheDocument();
    expect(screen.getByText(destination)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'usdt' } });
    fireEvent.change(screen.getByLabelText('Search withdrawals'), {
      target: { value: 'payout-alpha' },
    });
    fireEvent.click(screen.getByText('Search'));

    await vi.waitFor(() => expect(withdrawalQueries.some((path) =>
      path.includes('assetSymbol=USDT') && path.includes('search=payout-alpha'))).toBe(true));
  }, 60_000);

  it('filters failed webhooks and supports single and batch manual retry', async () => {
    const retryRequests: string[] = [];
    const deliveryQueries: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/custody/console/v1/webhooks') {
        return response([{
          id: 'endpoint-1',
          name: 'Production events',
          url: 'https://example.test/hooks',
          status: 'ACTIVE',
          successRate24h: 80,
        }]);
      }
      if (path === '/custody/console/v1/api-keys') return response([]);
      if (path === '/custody/console/v1/ip-allowlist') {
        return response({ enabled: false, rules: [] });
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
      if (path.includes('/webhook-deliveries/retry-failed') && init?.method === 'POST') {
        retryRequests.push(path);
        return response({ queued: 1 });
      }
      if (path.startsWith('/custody/console/v1/webhook-deliveries')) {
        deliveryQueries.push(path);
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
      <MemoryRouter initialEntries={['/console/api-access']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Developer access' }, { timeout: 15_000 });
    fireEvent.click(screen.getByRole('button', { name: /Add endpoint/ }));
    expect(screen.queryByText('Subscribed events')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deliveries' }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('combobox', { name: 'Delivery status' }));
    await user.click(await screen.findByText('Failed'));
    await vi.waitFor(() => expect(deliveryQueries.some((path) => path.includes('status=FAILED'))).toBe(true));
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
    fireEvent.click(screen.getByRole('button', { name: /Retry all failed/ }));
    const confirmations = await screen.findAllByRole('button', { name: 'OK' });
    fireEvent.click(confirmations[confirmations.length - 1]);
    await screen.findByText('1 deliveries queued for retry');
    expect(retryRequests).toEqual([
      '/custody/console/v1/webhook-deliveries/delivery-1/retry',
      '/custody/console/v1/webhook-deliveries/retry-failed?endpointId=endpoint-1',
    ]);
  }, 60_000);

  it('manages the collection address and lists tokens enabled with the chain', async () => {
    let generated = false;
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push({ path, init });
      if (path === '/custody/console/v1/gas-accounts' && init?.method === 'POST') {
        generated = true;
        return response({ ...gasAccount, childIndex: 1 }, 201);
      }
      if (path === '/custody/console/v1/chains') {
        return response([{
            chain: 'ETH',
            network: 'sepolia',
            family: 'evm',
            nativeSymbol: 'ETH',
            assetSymbols: ['ETH', 'USDT', 'USDC'],
            collectionAddressId: generated ? gasAccount.custodyAddressId : null,
            collectionAddress: generated ? gasAccount.address : null,
            status: 'ACTIVE',
            enabled: true,
            scanEnabled: true,
            withdrawalEnabled: true,
            transferEnabled: true,
            capabilities: ['NATIVE_QUOTE', 'TOKEN_QUOTE'],
            tokens: [{
              symbol: 'USDT', standard: 'ERC20', contractAddress: '0x1234', decimals: 6,
              platformEnabled: true,
            }, {
              symbol: 'USDC', standard: 'ERC20', contractAddress: '0x5678', decimals: 6,
              platformEnabled: false,
            }],
          }, {
            chain: 'BTC', network: 'regtest', family: 'utxo', nativeSymbol: 'BTC',
            assetSymbols: ['BTC'], status: 'ACTIVE', enabled: true,
            scanEnabled: true, withdrawalEnabled: true, transferEnabled: true,
            capabilities: ['NATIVE_QUOTE'], tokens: [],
          }]);
      }
      throw new Error(`Unhandled request: ${path}`);
    }));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/console/chains']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Chains', level: 1 }, { timeout: 15_000 });
    const initialRow = (await screen.findByText('sepolia')).closest('tr');
    expect(initialRow).not.toBeNull();
    if (!initialRow) throw new Error('Enabled chain row was not rendered');
    expect(within(initialRow).getByText('Not generated')).toBeInTheDocument();
    expect(screen.queryByText('Platform unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Enabled with chain')).not.toBeInTheDocument();
    await user.click(within(initialRow).getByRole('button', { name: 'Expand row' }));
    expect(await screen.findByText('Platform unavailable')).toBeInTheDocument();
    expect(screen.getByText('Enabled with chain')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /ETH USDT/ })).not.toBeInTheDocument();
    const btcRow = (await screen.findByText('regtest')).closest('tr');
    expect(btcRow).not.toBeNull();
    if (!btcRow) throw new Error('Native-only chain row was not rendered');
    expect(within(btcRow).queryByRole('button', { name: 'Expand row' })).not.toBeInTheDocument();
    expect(document.querySelector('.tenant-chains-panel .ant-table-sticky-scroll')).toBeNull();
    await user.click(within(initialRow).getByRole('button', { name: /Generate address/ }));

    const address = await screen.findByText(gasAccount.address);
    const generatedRow = address.closest('tr');
    expect(generatedRow).not.toBeNull();
    if (!generatedRow) throw new Error('Generated chain row was not rendered');
    expect(within(generatedRow).getByRole('button', {
      name: `Copy ${gasAccount.address}`,
    })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Child index' })).not.toBeInTheDocument();
    const create = requests.find((item) => item.path === '/custody/console/v1/gas-accounts'
      && item.init?.method === 'POST');
    expect(JSON.parse(String(create?.init?.body))).toEqual({ chain: 'ETH' });

    expect(requests.some((item) => item.path.includes('/tokens/'))).toBe(false);
  }, 60_000);
});
