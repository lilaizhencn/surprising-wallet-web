import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';

const tenantId = '00000000-0000-0000-0000-000000000001';
const adminId = '59ca252a-2c02-474b-a906-e79f8eb194e0';
const receipt = {
  intentHash: 'immutable-intent-hash', status: 'PENDING', reasons: ['NEW_RECIPIENT'], requiredReviewers: 2,
  policyVersion: 3, expiresAt: '2099-01-01T00:00:00Z', signingStarted: false,
  assetSnapshot: { networkIdentity: 'aptos:2', tokenIdentifier: null, nativeSymbol: 'APT' },
};
const withdrawal = {
  withdrawalId: 'withdrawal-1', orderId: 42, state: 'PENDING', receipt,
  intent: { id: '11111111-1111-4111-8111-111111111111', businessReference: 'CW-admin-review', chain: 'APTOS', network: 'testnet',
    assetSymbol: 'APT', amount: '0.001', recipient: '0xrecipient', maximumNetworkFee: '0.05', source: 'API', subject: 'customer-1',
    initiatorId: 'api-key-1', externalReference: 'merchant-1', fundingSource: 'TENANT_POOL' },
};
function response(body: unknown): Response {
  return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body } as Response;
}
function signIn() {
  saveSession({ version: 2, accountType: 'tenant', expiresAt: '2099-01-01', userId: adminId, tenantId, tenantSlug: 'demo',
    displayName: 'Tenant Admin', email: 'tenant-admin@example.test', role: 'TENANT_ADMIN', scopes: ['*'] });
}
afterEach(() => { clearSession(); vi.unstubAllGlobals(); });

it('shows the tenant administrator every request without an approval login and verifies each decision with a password', async () => {
  signIn(); const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith('/custody/console/v1/approvals?')) return response({ items: [withdrawal], total: 1 });
    if (path.endsWith('/decisions/step-up')) {
      writes.push({ path, body: JSON.parse(String(init?.body)) });
      return response({ status: 'PENDING' });
    }
    throw new Error(`Unexpected request: ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/console/approvals']}><App /></MemoryRouter>);
  await screen.findByText('CW-admin-review');
  expect(screen.queryByText('Independent approval sign in')).not.toBeInTheDocument();
  const row = screen.getByText('CW-admin-review').closest('tr') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Details' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('0xrecipient')).toBeInTheDocument();
  expect(dialog.getByText('immutable-intent-hash')).toBeInTheDocument();
  expect(dialog.getByText('NEW_RECIPIENT')).toBeInTheDocument();
  await user.click(dialog.getByRole('button', { name: 'Approve' }));
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Recipient and amount checked');
  await user.type(dialog.getByLabelText('Approval password'), 'review88');
  await user.click(dialog.getByRole('button', { name: 'Record decision' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ path: `/approval/v1/requests/${withdrawal.intent.id}/decisions/step-up`, body: {
    tenantId, memberId: adminId, password: 'review88', decision: 'APPROVE', reason: 'Recipient and amount checked', intentHash: 'immutable-intent-hash',
  } });
  expect(JSON.stringify(sessionStorage)).not.toContain('review88');
}, 30000);

it('keeps a self-initiated console withdrawal view-only', async () => {
  signIn();
  const self = { ...withdrawal, intent: { ...withdrawal.intent, initiatorId: adminId, source: 'CONSOLE' } };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith('/custody/console/v1/approvals?')) return response({ items: [self], total: 1 });
    throw new Error(String(input));
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/console/approvals']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: 'Details' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(dialog.getByText('This request cannot be reviewed by the current account.')).toBeInTheDocument();
}, 30000);
