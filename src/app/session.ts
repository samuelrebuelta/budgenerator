import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  setSessionUid,
  sessionUid,
  sessionRevision,
  isSessionCurrent,
  withTimeout,
} from '@/shared/model/session';
import { useSyncStore, flushWrites, hasPendingWrites } from '@/shared/model/sync';
import { toUserMessage } from '@/shared/lib/errors';
import { useBudgetStore, resetBudgetStore } from '@/entities/budget/model/store';
import { useCatalogStore, resetCatalogStore } from '@/entities/catalog/model/store';
import { useProfileStore, resetProfileStore } from '@/entities/profile/model/store';
import { useProjectStore, resetProjectStore } from '@/entities/project';
import { resetWorkforceStore } from '@/entities/workforce';
import { useTemplateStore, resetTemplateStore } from '@/entities/template/model/store';
import { useUserStore, resetUserStore } from '@/entities/user/model/store';
import {
  clearMemoryResources,
  restorePersistedMemoryResources,
} from '@/shared/lib/memoryResourceCache';
import {
  deleteOfflineUserData,
  restoreOfflineStores,
  withOfflinePersistenceSuspended,
} from '@/shared/lib/offlineStateCache';
import {
  isBrowserDisconnected,
  markNetworkAvailable,
  reportNetworkUnavailable,
} from '@/shared/model/network';
export const useSessionStore = create<{
  uid: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}>(() => ({ uid: null, status: 'idle', error: null }));
let loading: Promise<void> | null = null;
export function resetSession(uid: string | null) {
  const previous = sessionUid();
  if (previous && previous !== uid) void deleteOfflineUserData(previous);
  setSessionUid(uid);
  withOfflinePersistenceSuspended(() => {
    clearMemoryResources();
    resetBudgetStore();
    resetCatalogStore();
    resetProfileStore();
    resetProjectStore();
    resetWorkforceStore();
    resetTemplateStore();
    resetUserStore();
    useSyncStore.setState({ jobs: {} });
  });
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
export function loadSession(
  user: User,
  retry = false,
  writesAlreadyFlushed = false,
): Promise<void> {
  if (sessionUid() !== user.uid) resetSession(user.uid);
  if (loading) return loading;
  if (useSessionStore.getState().status === 'ready' && !retry) return Promise.resolve();
  const revision = sessionRevision();
  const sessionWasReady = useSessionStore.getState().status === 'ready';
  if (!sessionWasReady) useSessionStore.setState({ uid: user.uid, status: 'loading', error: null });
  loading = (async () => {
    try {
      if (!sessionWasReady)
        await Promise.all([
          restoreOfflineStores(user.uid),
          restorePersistedMemoryResources(user.uid),
        ]);
      if (!isSessionCurrent(user.uid, revision)) return;
      if (isBrowserDisconnected()) {
        useSessionStore.setState({ uid: user.uid, status: 'ready', error: null });
        return;
      }
      if (retry && !writesAlreadyFlushed) {
        await withTimeout(flushWrites());
        if (hasPendingWrites()) throw new Error('Hay cambios pendientes de sincronizar.');
      }
      await withTimeout(
        Promise.all([
          useUserStore.getState().loadUserData(user.uid, user.email ?? ''),
          useBudgetStore.getState().loadBudgets(user.uid),
          useCatalogStore.getState().loadCatalogs(user.uid, true),
          useProfileStore.getState().loadProfile(user.uid, user.email ?? ''),
          useProjectStore.getState().loadProjects(user.uid, true),
          useTemplateStore.getState().loadTemplates(user.uid),
        ]),
      );
      if (isSessionCurrent(user.uid, revision)) {
        markNetworkAvailable('session');
        useSessionStore.setState({ status: 'ready' });
      }
    } catch (error) {
      if (isSessionCurrent(user.uid, revision)) {
        const offline = reportNetworkUnavailable(error);
        useSessionStore.setState({
          status: offline || sessionWasReady ? 'ready' : 'error',
          error:
            offline || sessionWasReady
              ? null
              : toUserMessage(error, 'No hemos podido abrir tu espacio de trabajo.'),
        });
      }
    } finally {
      if (isSessionCurrent(user.uid, revision)) loading = null;
    }
  })();
  return loading;
}

export async function probeSessionConnection(user: User): Promise<boolean> {
  if (isBrowserDisconnected()) return false;
  try {
    await withTimeout(useProjectStore.getState().loadProjects(user.uid, true));
    markNetworkAvailable('request');
    return true;
  } catch (error) {
    reportNetworkUnavailable(error);
    return false;
  }
}

export { retryUnauthenticatedRouteConnection } from './sessionModule';

/** True while the budget editor holds an unsaved new budget. */
export function hasBudgetDraft(): boolean {
  return Boolean(useBudgetStore.getState().draftBudget);
}

export function hasDirtyBudgetDraft(): boolean {
  return useBudgetStore.getState().draftDirty;
}

export async function prepareSignOut() {
  await withTimeout(flushWrites());
}
