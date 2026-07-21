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
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
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
  get<T>(path: string, signal?: AbortSignal) {
    return apiRequest<T>(path, { signal });
  },
  post<T>(path: string, body?: unknown, headers?: HeadersInit) {
    return apiRequest<T>(path, { method: 'POST', body, headers });
  },
  put<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PUT', body });
  },
  patch<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PATCH', body });
  },
  delete<T>(path: string) {
    return apiRequest<T>(path, { method: 'DELETE' });
  },
};
