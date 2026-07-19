import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../api/client';

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('apiRequest', () => {
  it('sends bearer authentication and JSON without leaking the token into the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }, 200));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/custody/console/v1/addresses', {
      method: 'POST',
      token: 'cs_secret',
      body: { chain: 'ETH' },
    });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer cs_secret');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(options.body).toBe('{"chain":"ETH"}');
  });

  it('preserves structured API error codes and messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      error: { code: 'FORBIDDEN', message: 'tenant is suspended' },
    }, 403)));

    await expect(apiRequest('/custody/console/v1/assets')).rejects.toEqual(
      expect.objectContaining({
        name: ApiError.name,
        status: 403,
        code: 'FORBIDDEN',
        message: 'tenant is suspended',
      }),
    );
  });
});
