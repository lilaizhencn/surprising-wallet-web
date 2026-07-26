const API_BASE = (import.meta.env.VITE_CUSTODY_API_BASE ?? '').replace(/\/$/, '');
const GET_CACHE_TTL_MS = 10_000;

type CachedGet = {
  expiresAt: number;
  promise: Promise<unknown>;
};

const getCache = new Map<string, CachedGet>();

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

export function invalidateApiCache() {
  getCache.clear();
}

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

function cachedGet<T>(path: string): Promise<T> {
  const now = Date.now();
  const cached = getCache.get(path);
  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }
  const promise = apiRequest<T>(path).catch((error: unknown) => {
    if (getCache.get(path)?.promise === promise) {
      getCache.delete(path);
    }
    throw error;
  });
  getCache.set(path, { expiresAt: now + GET_CACHE_TTL_MS, promise });
  return promise;
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Request aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('Request aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

export const api = {
  get<T>(path: string, signal?: AbortSignal) {
    return withAbort(cachedGet<T>(path), signal);
  },
  post<T>(path: string, body?: unknown, headers?: HeadersInit) {
    invalidateApiCache();
    return apiRequest<T>(path, { method: 'POST', body, headers });
  },
  put<T>(path: string, body?: unknown) {
    invalidateApiCache();
    return apiRequest<T>(path, { method: 'PUT', body });
  },
  patch<T>(path: string, body?: unknown) {
    invalidateApiCache();
    return apiRequest<T>(path, { method: 'PATCH', body });
  },
  delete<T>(path: string) {
    invalidateApiCache();
    return apiRequest<T>(path, { method: 'DELETE' });
  },
};
