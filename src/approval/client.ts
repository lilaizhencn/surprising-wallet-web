// Approval requests use the console origin and are forwarded to the separate approval authority.
export class ApprovalApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export async function approvalRequest<T>(path: string, options: { method?: string; body?: unknown; csrf?: string; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrf) headers['X-Approval-CSRF'] = options.csrf;
  const response = await fetch(`/approval/v1${path}`, { method: options.method ?? 'GET', headers, credentials: 'same-origin', cache: 'no-store',
    signal: options.signal, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const body = await response.json() as unknown;
  if (!response.ok) throw new ApprovalApiError(response.status, (body as { message?: string }).message ?? `HTTP ${response.status}`);
  return body as T;
}
