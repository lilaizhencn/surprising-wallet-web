const API_BASE = (import.meta.env.VITE_CUSTODY_API_BASE ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as unknown)
    : await response.text();

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request failed with HTTP ${response.status}`,
    );
  }
  return payload as T;
}

export const api = {
  get<T>(path: string, token: string, signal?: AbortSignal) {
    return apiRequest<T>(path, { token, signal });
  },
  post<T>(path: string, token: string, body?: unknown, headers?: HeadersInit) {
    return apiRequest<T>(path, { method: 'POST', token, body, headers });
  },
  put<T>(path: string, token: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PUT', token, body });
  },
  patch<T>(path: string, token: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PATCH', token, body });
  },
  delete<T>(path: string, token: string) {
    return apiRequest<T>(path, { method: 'DELETE', token });
  },
};
