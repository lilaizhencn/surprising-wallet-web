import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';

const base = '/custody/console/v1';
function response(body: unknown): Response { return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body } as Response; }
function signIn() { saveSession({ version: 2, accountType: 'tenant', expiresAt: '2099-01-01', userId: 'admin', tenantId: 'tenant', tenantSlug: 'acme', displayName: 'Test Admin', email: 'admin@example.test', role: 'TENANT_ADMIN', scopes: ['*'] }); }
afterEach(() => { clearSession(); vi.unstubAllGlobals(); });

it('opens account security when clicking the nickname and binds a QR code only after confirmation', async () => {
  signIn(); let bound = false; const writes: Array<{ path: string; body: unknown }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    const path = String(input);
    if (path === `${base}/account-security`) return response({ userId: 'admin', emailRequired: false, totpRequired: false, totpBound: bound, emailDeliveryConfigured: false });
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body); writes.push({ path, body });
      if (path.endsWith('/totp/setup')) return response({ secret: 'TESTONLYSECRET', uri: 'otpauth://totp/test?secret=TESTONLYSECRET', expiresAt: '2099-01-01' });
      if (path.endsWith('/totp/confirm')) { bound = true; return response({}); }
    }
    throw new Error(path);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/console/account-security']}><App /></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: /Test Admin/ }));
  await user.click(await screen.findByRole('menuitem', { name: /Account security/ }));
  await screen.findByText('Email delivery is not configured. Email verification cannot be enabled yet.');
  expect(screen.getByRole('switch', { name: 'Require email verification' })).toBeDisabled();
  await user.type(screen.getByLabelText('Current password'), 'test-password');
  await user.click(screen.getByRole('button', { name: 'Show binding QR code' }));
  await screen.findByText('TESTONLYSECRET'); expect(bound).toBe(false);
  await user.type(screen.getByLabelText('Authenticator code'), '123456'); await user.click(await screen.findByRole('button', { name: 'Confirm binding' }));
  await waitFor(() => expect(bound).toBe(true)); await screen.findByText('Bound');
  expect(writes).toEqual([{ path: `${base}/account-security/totp/setup`, body: { password: 'test-password' } }, { path: `${base}/account-security/totp/confirm`, body: { code: '123456' } }]);
  expect(screen.queryByText('TESTONLYSECRET')).not.toBeInTheDocument();
}, 30000);
