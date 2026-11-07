import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { WriteQueue } from '../src/shared/lib/writeQueue';
import { useSyncStore } from '../src/shared/model/sync';
import {
  markNetworkAvailable,
  reportNetworkUnavailable,
  setNetworkOnline,
  useNetworkStore,
} from '../src/shared/model/network';
import { useToastStore } from '../src/shared/model/toast';
const queues: WriteQueue<number>[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  useSyncStore.setState({ jobs: {} });
  setNetworkOnline(true);
  useToastStore.setState({ toast: null, offlineNoticeShown: false });
});
afterEach(() => {
  queues.forEach((q) => q.clear());
  queues.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function queue(write: (key: string, value: number) => Promise<void>) {
  const q = new WriteQueue('test:', write, 100);
  queues.push(q);
  return q;
}
it('does not cancel a different document debounce', async () => {
  const write = vi.fn(async () => {});
  const q = queue(write);
  q.schedule('alice/a', 1);
  q.schedule('alice/b', 2);
  await vi.advanceTimersByTimeAsync(100);
  expect(write.mock.calls).toEqual([
    ['alice/a', 1],
    ['alice/b', 2],
  ]);
});
it('serializes newer edits behind an in-flight request', async () => {
  let resolve!: () => void;
  const values: number[] = [];
  const q = queue(async (_key, value) => {
    values.push(value);
    if (value === 1) await new Promise<void>((r) => (resolve = r));
  });
  q.schedule('a', 1);
  await vi.advanceTimersByTimeAsync(100);
  q.schedule('a', 2);
  q.schedule('a', 3);
  resolve();
  await q.flush();
  expect(values).toEqual([1, 3]);
});
it('retains a failed snapshot for retry and exposes the error', async () => {
  const write = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
  const q = queue(write);
  q.schedule('a', 7);
  await vi.advanceTimersByTimeAsync(100);
  expect(useSyncStore.getState().jobs['test:a']?.error).toBeTruthy();
  await q.flush();
  expect(write).toHaveBeenCalledTimes(2);
  expect(useSyncStore.getState().jobs['test:a']?.error).toBeUndefined();
});
it('cancels pending saves before delete and waits for an in-flight write', async () => {
  const write = vi.fn(async () => {});
  const q = queue(write);
  q.schedule('a', 1);
  await q.cancel('a');
  await vi.advanceTimersByTimeAsync(100);
  expect(write).not.toHaveBeenCalled();
});
it('flushes a queued edit when Firebase recovers without a browser online event', async () => {
  const write = vi.fn(async () => {
    if (!useNetworkStore.getState().online) throw new Error('offline');
  });
  const q = queue(write);
  q.schedule('alice/a', 3);
  reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));
  await vi.advanceTimersByTimeAsync(100);

  expect(write).toHaveBeenCalledTimes(1);
  expect(useNetworkStore.getState()).toMatchObject({ online: false, browserOnline: true });
  expect(useSyncStore.getState().jobs['test:alice/a']?.pending).toBe(false);
  expect(useSyncStore.getState().jobs['test:alice/a']?.error).toBeTruthy();

  markNetworkAvailable();
  await vi.advanceTimersByTimeAsync(0);

  expect(write).toHaveBeenCalledTimes(2);
  expect(useSyncStore.getState().jobs['test:alice/a']?.pending).toBe(false);
});

it('waits for the physical browser reconnect before flushing a late offline write', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const write = vi.fn(async () => {
    if (!useNetworkStore.getState().online) throw new Error('offline');
  });
  const q = queue(write);
  setNetworkOnline(false);
  q.schedule('alice/a', 4);
  await vi.advanceTimersByTimeAsync(100);
  expect(useSyncStore.getState().jobs['test:alice/a']?.error).toBeTruthy();

  markNetworkAvailable();
  expect(useNetworkStore.getState().online).toBe(false);
  vi.stubGlobal('navigator', { onLine: true });
  setNetworkOnline(true);
  await vi.advanceTimersByTimeAsync(0);

  expect(write).toHaveBeenCalledTimes(2);
  expect(useSyncStore.getState().jobs['test:alice/a']?.error).toBeUndefined();
});
