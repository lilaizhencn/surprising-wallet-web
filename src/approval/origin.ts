export function approvalOrigin(): string | undefined {
  try {
    const configured = import.meta.env.VITE_APPROVAL_ORIGIN;
    if (!configured) return undefined;
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '' && url.pathname !== '/')) return undefined;
    return url.origin;
  } catch { return undefined; }
}
