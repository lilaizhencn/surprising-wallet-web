import { App as AntApp } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession } from '../auth/session';
import LoginPage from '../pages/LoginPage';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('LoginPage', () => {
  beforeEach(() => clearSession());
  afterEach(() => clearSession());

  it('authenticates a tenant and stores only the returned Console session', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      expiresAt: '2099-01-01T00:00:00Z',
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      tenantSlug: 'acme-pay',
      email: 'admin@acme.test',
      displayName: 'Acme Admin',
      role: 'TENANT_ADMIN',
      scopes: ['*'],
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AntApp>
        <MemoryRouter initialEntries={['/console/login']}>
          <Routes>
            <Route path="/console/login" element={<LoginPage />} />
            <Route path="/console/overview" element={<h1>Tenant overview</h1>} />
          </Routes>
        </MemoryRouter>
      </AntApp>,
    );

    expect(screen.queryByLabelText(/tenant slug/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), 'admin@acme.test');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await screen.findByRole('heading', { name: /tenant overview/i });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/custody/console/v1/auth/login');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      email: 'admin@acme.test',
      password: 'correct horse battery staple',
    });
    await waitFor(() => {
      expect(getSession()).toMatchObject({
        accountType: 'tenant',
        tenantSlug: 'acme-pay',
        role: 'TENANT_ADMIN',
        scopes: ['*'],
      });
      expect(getSession()).not.toHaveProperty('token');
    });
  }, 15_000);

  it('returns a tenant to the requested Console page after sign-in', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      expiresAt: '2099-01-01T00:00:00Z',
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      tenantSlug: 'acme-pay',
      email: 'admin@acme.test',
      displayName: 'Acme Admin',
      role: 'TENANT_ADMIN',
      scopes: ['*'],
    })));

    render(
      <AntApp>
        <MemoryRouter initialEntries={[{
          pathname: '/console/login',
          state: { from: '/console/chains', accountType: 'tenant' },
        }]}>
          <Routes>
            <Route path="/console/login" element={<LoginPage />} />
            <Route path="/console/chains" element={<h1>Chains</h1>} />
          </Routes>
        </MemoryRouter>
      </AntApp>,
    );

    await user.type(screen.getByLabelText(/email/i), 'admin@acme.test');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('heading', { name: /^chains$/i })).toBeInTheDocument();
  }, 15_000);
});

it('keeps business access locked until email verification and authenticator enrollment both finish', async () => {
  clearSession();
  const result = { expiresAt: '2099-01-01T00:00:00Z', userId: 'user', tenantId: 'tenant', tenantSlug: 'test', email: 'mfa@example.test', displayName: 'MFA', role: 'OPERATOR', scopes: ['withdrawals:read'],
    verificationRequired: true, emailRequired: true, emailVerified: false, totpRequired: true, totpSetupRequired: true };
  const writes: Array<{ path: string; body: unknown }> = [];
  let verifiedEmail = false;
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    const path = String(input); writes.push({ path, body: init?.body ? JSON.parse(init.body) : undefined });
    if (path.endsWith('/login')) return jsonResponse(result);
    if (path.endsWith('/email-code')) return jsonResponse({ ok: true });
    if (path.endsWith('/totp/setup')) return jsonResponse({ secret: 'TESTONLYSECRET', uri: 'otpauth://totp/test?secret=TESTONLYSECRET', expiresAt: '2099-01-01' });
    if (path.endsWith('/verify')) {
      if (!verifiedEmail) { verifiedEmail = true; return jsonResponse({ ...result, emailVerified: true }); }
      return jsonResponse({ ...result, verificationRequired: false, emailVerified: true, totpSetupRequired: false });
    }
    throw new Error(path);
  }));
  const user = userEvent.setup();
  render(<AntApp><MemoryRouter initialEntries={['/console/login']}><Routes><Route path="/console/login" element={<LoginPage />} /><Route path="/console/overview" element={<h1>Protected business</h1>} /></Routes></MemoryRouter></AntApp>);
  await user.type(screen.getByLabelText('Email'), 'mfa@example.test'); await user.type(screen.getByLabelText('Password'), 'test-password-123'); await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText('Complete sign-in verification'); expect(getSession()).toBeNull(); expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Send email code' }));
  await user.type(screen.getByLabelText('Email verification code'), '123456'); await user.click(await screen.findByRole('button', { name: 'Verify and continue' }));
  await user.click(await screen.findByRole('button', { name: 'Show binding QR code' }));
  await screen.findByText('TESTONLYSECRET'); expect(getSession()).toBeNull(); expect(sessionStorage.getItem('surprising-wallet.session.v2')).toBeNull();
  await user.type(screen.getByLabelText('Authenticator code'), '654321'); await user.click(await screen.findByRole('button', { name: 'Verify and continue' }));
  await screen.findByText('Protected business'); expect(getSession()?.email).toBe('mfa@example.test');
  expect(writes.filter(w => w.path.endsWith('/verify')).map(w => w.body)).toEqual([{ emailCode: '123456' }, { totpCode: '654321' }]);
  clearSession();
}, 30000);
