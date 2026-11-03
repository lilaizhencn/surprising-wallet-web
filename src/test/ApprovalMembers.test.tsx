import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import { clearSession, saveSession } from '../auth/session';
import { ApprovalMembersPanel, ApprovalAuditPanel } from '../approval/ApprovalMembersPanel';

vi.mock('../approval/origin', () => ({ approvalOrigin: () => window.location.origin }));
const memberId = '11111111-1111-4111-8111-111111111111';
const member = { id: memberId, email: 'reviewer@example.test', displayName: 'Existing reviewer', role: 'APPROVER', status: 'ACTIVE', walletRevocationSequence: 0 };
const activation = { memberId, token: 'a'.repeat(64), expiresAt: '2099-01-01T00:00:00Z' };
function response(body: unknown, status = 200): Response { return { ok: status < 400, status, json: async () => body } as Response; }
afterEach(() => { clearSession(); window.history.replaceState(null, '', '/'); });

it('invites a verified public Wallet identity and requires reasons for reset and disable with independent CSRF', async () => {
  const writes: Array<{ path: string; body: unknown; csrf: unknown }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith('/approval/v1/members?')) return response({ items: [member], total: 1 });
    if (path.endsWith('/wallet-revocation')) return response({ sequence: 0 });
    writes.push({ path, body: JSON.parse(String(init?.body)), csrf: (init?.headers as Record<string, string>)?.['X-Approval-CSRF'] });
    return response(path.endsWith('/disable') ? { ok: true } : activation);
  }));
  const user = userEvent.setup();
  render(<AntApp><ApprovalMembersPanel csrf="independent-csrf" onExpired={vi.fn()} /></AntApp>);
  await screen.findByText('Existing reviewer');
  await user.click(screen.getByRole('button', { name: 'Invite reviewer' }));
  let dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Wallet member ID' }), memberId);
  await user.type(dialog.getByRole('textbox', { name: 'Email' }), 'new@example.test');
  await user.type(dialog.getByRole('textbox', { name: 'Name' }), 'New reviewer');
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Verified independent reviewer identity');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await screen.findByText(`${window.location.origin}/console/approvals#activate=${activation.token}`);
  expect(writes[0]).toEqual({ path: '/approval/v1/members', csrf: 'independent-csrf', body: { memberId, email: 'new@example.test', displayName: 'New reviewer', reason: 'Verified independent reviewer identity', acknowledgedWalletRevocation: 0 } });
  expect(JSON.stringify(localStorage)).not.toContain(activation.token);
  await user.click(screen.getByText('Close', { selector: 'button span' }));
  await waitFor(() => expect(screen.queryByText(`${window.location.origin}/console/approvals#activate=${activation.token}`)).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Reset independent credentials' }));
  dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('The old password, sessions and activation link stop working immediately.')).toBeInTheDocument();
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Suspected independent credential exposure');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await screen.findByText(`${window.location.origin}/console/approvals#activate=${activation.token}`);
  expect(writes[1]).toMatchObject({ path: `/approval/v1/members/${memberId}/activation`, csrf: 'independent-csrf', body: { reason: 'Suspected independent credential exposure', acknowledgedWalletRevocation: 0 } });
  await user.click(screen.getByText('Close', { selector: 'button span' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Disable reviewer' }));
  dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Reviewer access is no longer required');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(writes).toHaveLength(3));
  expect(writes[2]).toMatchObject({ path: `/approval/v1/members/${memberId}/disable`, csrf: 'independent-csrf', body: { reason: 'Reviewer access is no longer required' } });
}, 60000);

it('does not reveal a late activation capability after the previous administrator panel unmounts', async () => {
  let finish: ((value: Response) => void) | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') return new Promise<Response>(resolve => { finish = resolve; });
    return response({ items: [member], total: 1 });
  }));
  const user = userEvent.setup();
  const view = render(<AntApp><ApprovalMembersPanel key="first-admin" csrf="csrf-1" onExpired={vi.fn()} /></AntApp>);
  await user.click(await screen.findByRole('button', { name: 'Reset independent credentials' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Issue a newly verified activation link');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(finish).toBeDefined());
  view.rerender(<AntApp><ApprovalMembersPanel key="second-admin" csrf="csrf-2" onExpired={vi.fn()} /></AntApp>);
  await act(async () => { finish?.(response(activation)); });
  expect(screen.queryByText(`${window.location.origin}/console/approvals#activate=${activation.token}`)).not.toBeInTheDocument();
}, 60000);

it('activates a fragment capability after Wallet sign in, without token storage or automatic approval login', async () => {
  saveSession({ version: 2, accountType: 'tenant', expiresAt: '2099-01-01', userId: memberId, tenantId: 'tenant-1', tenantSlug: 'tenant-1', displayName: 'Reviewer', email: 'reviewer@example.test', role: 'APPROVER', scopes: ['*'] });
  window.history.replaceState(null, '', `/console/approvals#activate=${activation.token}`);
  const calls: Array<{ path: string; body: unknown }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) }); return response({ ok: true });
  }));
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/console/approvals']}><App /></MemoryRouter>);
  await screen.findByText('Activate independent approval account');
  await user.type(screen.getByLabelText('New independent password'), 'independent-password-123');
  await user.type(screen.getByLabelText('Confirm password'), 'independent-password-123');
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
  await screen.findByText('Independent approval sign in');
  expect(calls).toEqual([{ path: '/approval/v1/auth/activate', body: { token: activation.token, password: 'independent-password-123' } }]);
  expect(window.location.hash).toBe('');
  expect(JSON.stringify(localStorage)).not.toContain(activation.token);
  expect(JSON.stringify(sessionStorage)).not.toContain(activation.token);
}, 60000);

it('reads independent audit facts and renders details as text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({ items: [{ id: 'audit-1', createdAt: '2026-11-01', action: 'MEMBER.DISABLE', actorType: 'MEMBER', actorId: 'admin-1', entityId: memberId, detail: { reason: '<script>unsafe</script>' } }], total: 1 })));
  render(<AntApp><ApprovalAuditPanel onExpired={vi.fn()} /></AntApp>);
  await screen.findByText('MEMBER.DISABLE');
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Expand row' }));
  await screen.findByText(/<script>unsafe<\/script>/);
  expect(document.querySelector('script')).toBeNull();
});

it('requires explicit acknowledgment of the latest Wallet revocation before inviting a reviewer', async () => {
  let sequence = 7;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith('/approval/v1/members?')) return response({ items: [], total: 0 });
    if (path.endsWith('/wallet-revocation')) return response({ sequence });
    writes.push(JSON.parse(String(init?.body))); return response(activation);
  }));
  const user = userEvent.setup();
  render(<AntApp><ApprovalMembersPanel csrf="independent-csrf" onExpired={vi.fn()} /></AntApp>);
  await user.click(screen.getByRole('button', { name: 'Invite reviewer' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Wallet member ID' }), memberId);
  await user.type(dialog.getByRole('textbox', { name: 'Email' }), 'new@example.test');
  await user.type(dialog.getByRole('textbox', { name: 'Name' }), 'Restored reviewer');
  await user.type(dialog.getByRole('textbox', { name: 'Reason' }), 'Independently verified current membership');
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  const checkbox = await dialog.findByRole('checkbox', { name: 'I verified this reviewer and explicitly approve re-enrollment' });
  expect(writes).toHaveLength(0);
  await user.click(checkbox); sequence = 8;
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(checkbox).not.toBeChecked());
  expect(writes).toHaveLength(0);
  await user.click(checkbox);
  await user.click(dialog.getByRole('button', { name: 'OK' }));
  await screen.findByText(`${window.location.origin}/console/approvals#activate=${activation.token}`);
  expect(writes).toEqual([{ memberId, email: 'new@example.test', displayName: 'Restored reviewer', reason: 'Independently verified current membership', acknowledgedWalletRevocation: 8 }]);
}, 90000);
