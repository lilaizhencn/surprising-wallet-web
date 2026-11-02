import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';

const tenantId = '22222222-2222-2222-2222-222222222222';
const adminId = '11111111-1111-1111-1111-111111111111';
const memberId = '33333333-3333-3333-3333-333333333333';
function signIn(role = 'TENANT_ADMIN') {
  saveSession({ version: 2, accountType: 'tenant', expiresAt: '2099-01-01T00:00:00Z',
    userId: adminId, tenantId, tenantSlug: 'members-test', email: 'admin@members.test',
    displayName: 'Admin', role, scopes: role === 'TENANT_ADMIN' ? ['*'] : ['approvals:review'] });
}
function response(body: unknown, status = 200): Response {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
beforeEach(() => { clearSession(); localStorage.clear(); signIn(); });
afterEach(() => { clearSession(); vi.unstubAllGlobals(); });

it('creates an operator, changes their role and resets their password through tenant member routes', async () => {
  let members = [{ id: adminId, email: 'admin@members.test', displayName: 'Admin', role: 'TENANT_ADMIN', status: 'ACTIVE' }];
  const writes: Array<{ path: string; body: Record<string, string> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/custody/console/v1/users/security') return response(members.map(m => ({ userId: m.id, emailRequired: false, totpRequired: false, totpBound: false, emailDeliveryConfigured: false })));
    if (path === '/custody/console/v1/users' && (!init?.method || init.method === 'GET')) return response(members);
    if (path.startsWith('/custody/console/v1/users') && init?.method) {
      const body = JSON.parse(String(init.body)) as Record<string, string>;
      writes.push({ path, body });
      if (init.method === 'POST' && path.endsWith('/users')) {
        members = [...members, { id: memberId, email: body.email, displayName: body.displayName, role: body.role, status: 'ACTIVE' }];
        return response(members[1], 201);
      }
      if (init.method === 'PUT') { members = members.map(m => m.id === memberId ? { ...m, ...body } : m); return response(members[1]); }
      if (path.endsWith('/reset-password')) return response({ ok: true });
    }
    throw new Error(`Unexpected request ${path}`);
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/console/users']}><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Team members' });
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Add member/ }));
  let modal = within(screen.getByRole('dialog'));
  await user.type(modal.getByRole('textbox', { name: 'Email' }), 'operator@members.test');
  await user.type(modal.getByRole('textbox', { name: 'Display name' }), 'Operator One');
  await user.type(modal.getByLabelText('Initial password'), 'member-password-123456');
  await user.click(modal.getByRole('button', { name: 'OK' }));
  await screen.findByText('operator@members.test');
  expect(writes[0].body).toEqual({ email: 'operator@members.test', displayName: 'Operator One', role: 'OPERATOR', password: 'member-password-123456' });
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  modal = within(screen.getByRole('dialog'));
  await user.click(modal.getByRole('combobox', { name: 'Role' }));
  await user.click(await screen.findByText('Approver', { selector: '.ant-select-item-option-content' }));
  await user.click(modal.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(writes[1]?.body.role).toBe('APPROVER'));
  expect(writes[1].body).not.toHaveProperty('password');
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  modal = within((await screen.findByLabelText('New password')).closest('[role=dialog]') as HTMLElement);
  await user.type(modal.getByLabelText('New password'), 'replacement-password-123456');
  await user.click(modal.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(writes[2]).toEqual({ path: `/custody/console/v1/users/${memberId}/reset-password`, body: { password: 'replacement-password-123456' } }));
}, 60_000);

it('prevents an approver from opening member management', async () => {
  signIn('APPROVER');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter initialEntries={['/console/users']}><App /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Add member/ })).not.toBeInTheDocument());
  expect(fetchMock.mock.calls.some(([path]) => String(path).includes('/users'))).toBe(false);
});
