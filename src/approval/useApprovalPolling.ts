import { useEffect, useState } from 'react';
import { ApprovalApiError } from './client';

/** Uncached serial polling. Hidden tabs pause, unmount aborts, transient failures retain rows. */
export function useApprovalPolling<T>(load: (signal: AbortSignal) => Promise<T>, onExpired: () => void, enabled: boolean, revision = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>();
  useEffect(() => {
    if (!enabled) { setData(undefined); setUpdatedAt(undefined); setError(''); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: AbortController | undefined;
    const run = async () => {
      if (stopped || active || document.hidden) return;
      const controller = new AbortController(); active = controller; setLoading(true);
      let delay = 5000;
      try {
        const next = await load(controller.signal);
        if (!stopped && !controller.signal.aborted) { setData(next); setError(''); setUpdatedAt(new Date()); }
      } catch (failure) {
        if (!stopped && !controller.signal.aborted) {
          if (failure instanceof ApprovalApiError && (failure.status === 401 || failure.status === 403)) { stopped = true; onExpired(); }
          else { setError(failure instanceof Error ? failure.message : 'Unable to update approvals'); delay = 15000; }
        }
      } finally {
        active = undefined;
        if (!stopped) { setLoading(false); if (!document.hidden) timer = setTimeout(() => { void run(); }, delay); }
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void run();
      else active?.abort();
    };
    document.addEventListener('visibilitychange', visibility);
    void run();
    return () => { stopped = true; clearTimeout(timer); active?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [load, onExpired, enabled, revision]);
  return { data, error, loading, updatedAt };
}
