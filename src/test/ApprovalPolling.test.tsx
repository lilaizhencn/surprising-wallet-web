import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApprovalApiError } from '../approval/client';
import { useApprovalPolling } from '../approval/useApprovalPolling';

afterEach(() => { vi.useRealTimers(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

it('updates the queue automatically, retains previous data during transient errors and stops after logout', async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce(['first']).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(['first', 'second']);
  const expired = vi.fn();
  const { result, unmount } = renderHook(() => useApprovalPolling(load, expired, true));
  await act(async () => {});
  expect(result.current.data).toEqual(['first']);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(result.current.data).toEqual(['first']); expect(result.current.error).toBe('offline');
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(result.current.data).toEqual(['first', 'second']); expect(result.current.error).toBe('');
  load.mockRejectedValue(new ApprovalApiError(401, 'expired'));
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(expired).toHaveBeenCalledTimes(1);
  const calls = load.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(load).toHaveBeenCalledTimes(calls);
  unmount();
});

it('does not overlap requests and aborts pending work when the page unmounts', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const load = vi.fn((value: AbortSignal) => { signal = value; return new Promise<string[]>(() => {}); });
  const expired = vi.fn();
  const { unmount } = renderHook(() => useApprovalPolling(load, expired, true));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(load).toHaveBeenCalledTimes(1); expect(signal?.aborted).toBe(false);
  unmount(); expect(signal?.aborted).toBe(true);
});

it('pauses hidden tabs and immediately loads when visible again', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  const load = vi.fn().mockResolvedValue(['new']); const expired = vi.fn();
  const { result, unmount } = renderHook(() => useApprovalPolling(load, expired, true));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(load).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current.data).toEqual(['new']); expect(load).toHaveBeenCalledTimes(1);
  unmount();
});
