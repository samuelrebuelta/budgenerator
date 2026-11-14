import { createStore } from 'zustand/vanilla';

export interface SyncState {
  jobs: Record<string, { pending: boolean; error?: string }>;
}

/** Pending and failed writes by queue key; the web binds it as `useSyncStore`. */
export const syncStore = createStore<SyncState>()(() => ({ jobs: {} }));
export function syncStatus(key: string, pending: boolean, error?: unknown) {
  syncStore.setState((s) => ({
    jobs: {
      ...s.jobs,
      [key]: {
        pending,
        error: error
          ? 'No se han podido guardar los cambios. Comprueba la conexión y reintenta.'
          : undefined,
      },
    },
  }));
}
const flushers = new Set<() => Promise<void>>();
let scheduledFlush: ReturnType<typeof setTimeout> | null = null;
export function registerFlusher(flush: () => Promise<void>) {
  flushers.add(flush);
}
export async function flushWrites() {
  await Promise.all([...flushers].map((flush) => flush()));
}
export function scheduleFlushWrites() {
  if (scheduledFlush !== null) return;
  scheduledFlush = setTimeout(() => {
    scheduledFlush = null;
    void flushWrites().catch(() => {});
  }, 0);
}
export function hasPendingWrites() {
  return Object.values(syncStore.getState().jobs).some((j) => j.pending || j.error);
}
