import { create } from 'zustand';
export const useSyncStore = create<{ jobs: Record<string, { pending: boolean; error?: string }> }>(
  () => ({ jobs: {} }),
);
export function syncStatus(key: string, pending: boolean, error?: unknown) {
  useSyncStore.setState((s) => ({
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
export function registerFlusher(flush: () => Promise<void>) {
  flushers.add(flush);
}
export async function flushWrites() {
  await Promise.all([...flushers].map((flush) => flush()));
}
export function hasPendingWrites() {
  return Object.values(useSyncStore.getState().jobs).some((j) => j.pending || j.error);
}
