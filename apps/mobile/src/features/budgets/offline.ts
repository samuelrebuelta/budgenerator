import { useStore } from 'zustand';
import { isBrowserDisconnected } from '@bg/app-core/network';
import { syncStore } from '@bg/app-core/sync';
import { showOfflineMutationToast } from '@bg/app-core/toast';

/**
 * D4 / BG-012: without network the app blocks every mutation of saved data and shows the offline
 * toast. Transactions (create, accept, delete, share) are already guarded by the repositories;
 * edits of a saved budget go through the `WriteQueue`, so the screens ask here first and do not
 * apply the change. A draft is local until «Guardar», so it stays editable offline.
 */
export function allowSavedMutation(): boolean {
  if (!isBrowserDisconnected()) return true;
  showOfflineMutationToast();
  return false;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** «Guardando… / Guardado» of a saved budget, from the `WriteQueue` job of `@bg/app-core`. */
export function useSaveStatus(uid: string | null, budgetId: string): SaveStatus {
  const job = useStore(syncStore, (state) =>
    uid ? state.jobs[`budget:${uid}/${budgetId}`] : undefined,
  );
  if (!job) return 'idle';
  if (job.error) return 'error';
  return job.pending ? 'saving' : 'saved';
}
