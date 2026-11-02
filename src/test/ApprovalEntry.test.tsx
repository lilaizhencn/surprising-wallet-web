import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';
vi.mock('../approval/origin', () => ({ approvalOrigin: () => 'https://review.example.test' }));
afterEach(() => { clearSession(); vi.unstubAllGlobals(); });
it('lists all tenant approval statuses without using the Wallet session to approve requests', async () => {
  saveSession({ version: 2, accountType: 'tenant', expiresAt: '2099-01-01', userId: 'admin', tenantId: 'tenant', tenantSlug: 'acme', email: 'admin@example.test', displayName: 'Admin', role: 'TENANT_ADMIN', scopes: ['*'] });
  const paths: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    expect(init?.method).not.toBe('POST'); paths.push(String(input));
    return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ total: 1, items: [{ withdrawalId: 'withdrawal', state: 'REJECTED', intent: { id: 'request', businessReference: 'CW-all-statuses', chain: 'ETH', network: 'mainnet', amount: '12', assetSymbol: 'USDC', recipient: 'recipient' } }] }) } as Response;
  }));
  render(<MemoryRouter initialEntries={['/console/approvals']}><App /></MemoryRouter>);
  await screen.findByText('CW-all-statuses'); expect(screen.getByText('REJECTED')).toBeInTheDocument();
  expect(new URL(paths[0], window.location.origin).searchParams.get('status')).toBe('');
  expect(screen.getByRole('link', { name: 'Open independent approvals' })).toHaveAttribute('href', 'https://review.example.test/approval');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(paths.length).toBe(2));
});
