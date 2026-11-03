import { afterEach, expect, it, vi } from 'vitest';
import worker from '../worker';

afterEach(() => vi.unstubAllGlobals());

it('forwards approval session credentials and CSRF on the console origin', async () => {
  let forwarded: Request | undefined;
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
    forwarded = request;
    return new Response('{"ok":true}', { status: 200, headers: { 'Set-Cookie': 'approval_session=test; HttpOnly; Secure; Path=/approval/v1', 'Content-Type': 'application/json' } });
  }));
  const env = { APPROVAL_UPSTREAM_ORIGIN: 'https://approval.example.test', ASSETS: { fetch: vi.fn() } };
  const response = await worker.fetch(new Request('https://custody.example.test/approval/v1/auth/login', {
    method: 'POST', headers: { Origin: 'https://custody.example.test', Cookie: 'approval_session=old', 'X-Approval-CSRF': 'csrf' }, body: '{}',
  }), env);
  expect(forwarded?.url).toBe('https://approval.example.test/approval/v1/auth/login');
  expect(forwarded?.headers.get('Origin')).toBe('https://custody.example.test');
  expect(forwarded?.headers.get('Cookie')).toBe('approval_session=old');
  expect(forwarded?.headers.get('X-Approval-CSRF')).toBe('csrf');
  expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(env.ASSETS.fetch).not.toHaveBeenCalled();
});

it('keeps service endpoints private and serves console pages from assets', async () => {
  const assets = { fetch: vi.fn(async () => new Response('console')) };
  const env = { APPROVAL_UPSTREAM_ORIGIN: 'https://approval.example.test', ASSETS: assets };
  expect((await worker.fetch(new Request('https://custody.example.test/approval/service/v1/intents'), env)).status).toBe(404);
  expect(await (await worker.fetch(new Request('https://custody.example.test/console/approvals'), env)).text()).toBe('console');
  expect(assets.fetch).toHaveBeenCalledTimes(1);
});
