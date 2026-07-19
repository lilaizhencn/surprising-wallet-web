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
      token: 'cs_test-session-token-with-safe-length',
      expiresAt: '2099-01-01T00:00:00Z',
      userId: '11111111-1111-1111-1111-111111111111',
      tenantId: '22222222-2222-2222-2222-222222222222',
      tenantSlug: 'acme-pay',
      email: 'admin@acme.test',
      displayName: 'Acme Admin',
      role: 'TENANT_ADMIN',
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

    await user.type(screen.getByLabelText(/tenant slug/i), 'acme-pay');
    await user.type(screen.getByLabelText(/email/i), 'admin@acme.test');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await screen.findByRole('heading', { name: /tenant overview/i });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/custody/console/v1/auth/login');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      tenantSlug: 'acme-pay',
      email: 'admin@acme.test',
      password: 'correct horse battery staple',
    });
    await waitFor(() => {
      expect(getSession()).toMatchObject({
        accountType: 'tenant',
        tenantSlug: 'acme-pay',
        role: 'TENANT_ADMIN',
      });
    });
  }, 15_000);
});
