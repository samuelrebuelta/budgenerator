import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  setSessionUid,
  sessionUid,
  sessionRevision,
  isSessionCurrent,
  withTimeout,
} from '@/shared/model/session';
import { useSyncStore, flushWrites } from '@/shared/model/sync';
import { useBudgetStore, resetBudgetStore } from '@/entities/budget/model/store';
import { useCatalogStore, resetCatalogStore } from '@/entities/catalog/model/store';
import { useProfileStore, resetProfileStore } from '@/entities/profile/model/store';
import { useTemplateStore, resetTemplateStore } from '@/entities/template/model/store';
import { useUserStore, resetUserStore } from '@/entities/user/model/store';
export const useSessionStore = create<{
  uid: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}>(() => ({ uid: null, status: 'idle', error: null }));
let loading: Promise<void> | null = null;
export function resetSession(uid: string | null) {
  const previous = sessionUid();
  setSessionUid(uid);
  resetBudgetStore();
  resetCatalogStore();
  resetProfileStore();
  resetTemplateStore();
  resetUserStore();
  useSyncStore.setState({ jobs: {} });
  if (previous && previous !== uid) {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(`cimbra-draft:${previous}:`)) sessionStorage.removeItem(key);
    } catch {
      /* Private mode. */
    }
  }
  loading = null;
  useSessionStore.setState({ uid, status: 'idle', error: null });
}
export function loadSession(user: User, retry = false): Promise<void> {
  if (sessionUid() !== user.uid) resetSession(user.uid);
  if (loading) return loading;
  if (useSessionStore.getState().status === 'ready' && !retry) return Promise.resolve();
  const revision = sessionRevision();
  useSessionStore.setState({ uid: user.uid, status: 'loading', error: null });
  loading = (async () => {
    try {
      await withTimeout(
        Promise.all([
          useUserStore.getState().loadUserData(user.uid, user.email ?? ''),
          useBudgetStore.getState().loadBudgets(user.uid),
          useCatalogStore.getState().loadCatalogs(user.uid),
          useProfileStore.getState().loadProfile(user.uid, user.email ?? ''),
          useTemplateStore.getState().loadTemplates(user.uid),
        ]),
      );
      if (isSessionCurrent(user.uid, revision)) useSessionStore.setState({ status: 'ready' });
    } catch (error) {
      if (isSessionCurrent(user.uid, revision))
        useSessionStore.setState({
          status: 'error',
          error:
            error instanceof Error ? error.message : 'No hemos podido abrir tu espacio de trabajo.',
        });
    } finally {
      if (isSessionCurrent(user.uid, revision)) loading = null;
    }
  })();
  return loading;
}
export async function prepareSignOut() {
  await withTimeout(flushWrites());
}
