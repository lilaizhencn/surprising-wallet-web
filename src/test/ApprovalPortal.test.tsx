import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../approval/origin', () => ({ approvalOrigin: () => window.location.origin }));
const principal = { tenantId: 'tenant-1', memberId: 'reviewer-1', role: 'APPROVER', displayName: 'Reviewer', email: 'reviewer@example.test', csrfToken: 'csrf-secret' };
const withdrawal = (id: string) => ({ assetSnapshot: { networkIdentity: 'eip155:11155111', tokenIdentifier: '0x3333333333333333333333333333333333333333', nativeSymbol: 'ETH' }, intent: { id, chain: 'ETH', network: 'eip155:11155111', assetSymbol: 'USDC', recipient: `address-${id}`,
  amount: '9007199254740993.123456789012345678901234', maximumNetworkFee: '0.01', source: 'API', subject: 'customer-42', businessReference: `CW-${id}`, initiatorId: 'api-key-1', externalReference: `merchant-${id}`, fundingSource: 'TENANT_POOL' },
  intentHash: `${id}-immutable-hash`, status: 'PENDING', reasons: ['NEW_RECIPIENT'], requiredReviewers: 1, policyVersion: 3, expiresAt: '2099-01-01T00:00:00Z', signingStarted: false });
function response(body: unknown, status = 200): Response {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body } as Response;
}
afterEach(() => { vi.unstubAllGlobals(); });

it('uses independent login, automatically adds new requests and sends the exact displayed intent hash with CSRF', async () => {
  let polls = 0; const writes: Array<{ path: string; init?: RequestInit }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/approval/v1/auth/session') return response({ message: 'independent login required' }, 401);
    if (path === '/approval/v1/auth/login') { writes.push({ path, init }); return response(principal); }
    if (path.startsWith('/approval/v1/requests?')) { polls++; const items = polls === 1 ? [withdrawal('first')] : [withdrawal('first'), withdrawal('second')]; return response({ items, total: items.length, limit: 20, offset: 0 }); }
    if (path === '/approval/v1/requests/first/decisions' && init?.method !== 'POST') return response([]);
    if (path === '/approval/v1/requests/first/decisions') { writes.push({ path, init }); return response({ ...withdrawal('first'), status: 'APPROVED' }); }
    throw new Error(`Unexpected request: ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/approval']}><App /></MemoryRouter>);
  await screen.findByText('Independent approval sign in');
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'reviewer@example.test');
  await user.type(screen.getByLabelText('Password'), 'independent-password-123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('CW-first');
  expect(screen.getByText('9007199254740993.123456789012345678901234 USDC')).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Approval policies' })).not.toBeInTheDocument();
  await screen.findByText('CW-second', {}, { timeout: 12000 });
  expect(polls).toBeGreaterThanOrEqual(2);
  const row = screen.getByText('CW-first').closest('tr') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Review' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('address-first')).toBeInTheDocument();
  expect(dialog.getByText('0x3333333333333333333333333333333333333333')).toBeInTheDocument();
  expect(dialog.getByText('eip155:11155111')).toBeInTheDocument();
  expect(dialog.getByText('0.01 ETH')).toBeInTheDocument();
  expect(dialog.getByText('merchant-first')).toBeInTheDocument();
  expect(dialog.getByText('Tenant pool')).toBeInTheDocument();
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Recipient and amount checked');
  await user.click(dialog.getByRole('button', { name: 'Record decision' }));
  await waitFor(() => expect(writes.length).toBe(2));
  expect(JSON.parse(String(writes[1].init?.body))).toEqual({ decision: 'APPROVE', reason: 'Recipient and amount checked', intentHash: 'first-immutable-hash' });
  expect(writes[1].init?.headers).toMatchObject({ 'X-Approval-CSRF': 'csrf-secret' });
  expect(writes[0].init?.credentials).toBe('same-origin');
}, 60000);

it('saves tenant thresholds as decimal strings and includes the expected policy version', async () => {
  let saved: Record<string, unknown> | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/approval/v1/auth/session') return response({ ...principal, role: 'TENANT_ADMIN' });
    if (path.startsWith('/approval/v1/requests?')) return response({ items: [], total: 0, limit: 20, offset: 0 });
    if (path === '/approval/v1/policies' && init?.method === 'PUT') { saved = JSON.parse(String(init.body)); return response(saved); }
    if (path === '/approval/v1/policies') return response([]);
    throw new Error(`Unexpected request: ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/approval']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('tab', { name: 'Approval policies' }));
  await user.click(screen.getByRole('button', { name: 'Add policy' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Chain' }), 'ETH');
  await user.type(dialog.getByRole('textbox', { name: 'Network' }), 'eip155:11155111');
  await user.type(dialog.getByRole('textbox', { name: 'Asset' }), 'USDC');
  await user.type(dialog.getByRole('textbox', { name: 'Single amount threshold' }), '9007199254740993.123456789012345678901234');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(saved).toBeDefined());
  expect(saved).toMatchObject({ chain: 'ETH', network: 'eip155:11155111', assetSymbol: 'USDC', expectedVersion: 0, singleAmount: '9007199254740993.123456789012345678901234',
    rolling24hAmount: null, allWithdrawals: true, newRecipient: true, consoleWithdrawal: true, requiredReviewers: 1, expirySeconds: 3600 });
}, 60000);

it('clears the previous tenant policy list when an independent session signs out', async () => {
  let policyReads = 0; let finishPolicies: ((response: Response) => void) | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/approval/v1/auth/session') return response({ ...principal, role: 'TENANT_ADMIN' });
    if (path.startsWith('/approval/v1/requests?')) return response({ items: [], total: 0, limit: 20, offset: 0 });
    if (path === '/approval/v1/policies') {
      policyReads++;
      if (policyReads === 1) return response([{ chain: 'ETH', network: 'eip155:11155111', assetSymbol: 'TENANT_ONE_ASSET', version: 1, singleAmount: '100', rolling24hAmount: null, allWithdrawals: true, newRecipient: true, consoleWithdrawal: true, requiredReviewers: 1, expirySeconds: 3600 }]);
      return new Promise<Response>(resolve => { finishPolicies = resolve; });
    }
    if (path === '/approval/v1/auth/logout') return response({ ok: true });
    if (path === '/approval/v1/auth/login' && init?.method === 'POST') return response({ ...principal, tenantId: 'tenant-2', memberId: 'admin-2', role: 'TENANT_ADMIN' });
    throw new Error(`Unexpected request: ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/approval']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('tab', { name: 'Approval policies' }));
  await screen.findByText('TENANT_ONE_ASSET');
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByText('Independent approval sign in');
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'admin2@example.test');
  await user.type(screen.getByLabelText('Password'), 'independent-password-456');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await user.click(await screen.findByRole('tab', { name: 'Approval policies' }));
  await waitFor(() => expect(policyReads).toBe(2));
  expect(screen.queryByText('TENANT_ONE_ASSET')).not.toBeInTheDocument();
  await act(async () => { finishPolicies?.(response([])); });
}, 60000);

it('ignores a late policy response from the previous independent tenant session', async () => {
  let policyReads = 0; let staleResponse: ((response: Response) => void) | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === '/approval/v1/auth/session') return response({ ...principal, role: 'TENANT_ADMIN' });
    if (path.startsWith('/approval/v1/requests?')) return response({ items: [], total: 0, limit: 20, offset: 0 });
    if (path === '/approval/v1/policies') { policyReads++; return policyReads === 1 ? new Promise<Response>(resolve => { staleResponse = resolve; }) : response([]); }
    if (path === '/approval/v1/auth/logout') return response({ ok: true });
    if (path === '/approval/v1/auth/login') return response({ ...principal, tenantId: 'tenant-2', memberId: 'admin-2', role: 'TENANT_ADMIN' });
    throw new Error(`Unexpected request: ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/approval']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('tab', { name: 'Approval policies' }));
  await waitFor(() => expect(staleResponse).toBeDefined());
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByText('Independent approval sign in');
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'admin2@example.test');
  await user.type(screen.getByLabelText('Password'), 'independent-password-456');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await user.click(await screen.findByRole('tab', { name: 'Approval policies' }));
  await waitFor(() => expect(policyReads).toBe(2));
  await act(async () => { staleResponse?.(response([{ chain: 'ETH', network: 'eip155:11155111', assetSymbol: 'LATE_TENANT_ONE_ASSET', version: 1 }])); });
  expect(screen.queryByText('LATE_TENANT_ONE_ASSET')).not.toBeInTheDocument();
}, 60000);

it('shows every status to the independent administrator and includes prior reviewers before assisting', async () => {
  const request = { ...withdrawal('assisted'), requiredReviewers: 2 }; let listPath = ''; let reviewed: unknown;
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    const path = String(input);
    if (path.endsWith('/auth/session')) return response({ ...principal, memberId: 'admin-1', role: 'TENANT_ADMIN' });
    if (path.includes('/requests?')) { listPath = path; return response({ items: [request], total: 1 }); }
    if (path.endsWith('/assisted/decisions')) {
      if (init?.method === 'POST') { reviewed = JSON.parse(String(init.body)); return response({ ...request, status: 'APPROVED' }); }
      return response([{ reviewerId: 'reviewer-1', decision: 'APPROVE', reason: 'First reviewer checked', createdAt: '2026-11-02T10:00:00Z' }]);
    }
    throw new Error(path);
  }));
  const user = userEvent.setup(); render(<MemoryRouter initialEntries={['/approval']}><App /></MemoryRouter>);
  await screen.findByText('CW-assisted'); expect(new URL(listPath, window.location.origin).searchParams.get('status')).toBe('');
  await user.click(screen.getByRole('button', { name: 'Review' }));
  await screen.findByText('First reviewer checked'); expect(screen.getByText('Approval progress: 1 / 2')).toBeInTheDocument();
  const dialog = within(screen.getByRole('dialog')); await user.type(dialog.getByLabelText('Reason'), 'Administrator independently checked');
  await user.click(dialog.getByRole('button', { name: 'Record decision' }));
  await waitFor(() => expect(reviewed).toMatchObject({ decision: 'APPROVE', intentHash: 'assisted-immutable-hash' }));
}, 30000);
