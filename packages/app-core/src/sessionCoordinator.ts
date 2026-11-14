import { createStore } from 'zustand/vanilla';
import { toUserMessage } from '@bg/domain/lib/errors';
import {
  setSessionUid,
  sessionUid,
  sessionRevision,
  isSessionCurrent,
  withTimeout,
} from './session.js';
import { syncStore, flushWrites, hasPendingWrites } from './sync.js';
import { clearMemoryResources, restorePersistedMemoryResources } from './memoryResourceCache.js';
import {
  deleteOfflineUserData,
  restoreOfflineStores,
  withOfflinePersistenceSuspended,
} from './offlineStateCache.js';
import {
  isBrowserDisconnected,
  markNetworkAvailable,
  reportNetworkUnavailable,
} from './network.js';
import type { DraftStorage } from './ports.js';
import { DRAFT_KEY_PREFIX } from './stores/budget.js';

/** What the coordinator reads from the platform `User` (Firebase JS SDK or RNFB). */
export interface SessionUser {
  readonly uid: string;
  readonly email: string | null;
}

export interface SessionState {
  uid: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export interface SessionCoordinatorOptions<TUser extends SessionUser> {
  /** Resets every entity store of the platform (memory resources and sync jobs are reset here). */
  resetStores(): void;
  /** Loads the stores a signed-in session needs before it is `ready`. */
  loadStores(user: TUser): Promise<unknown>;
  /** Lightweight Firebase read used as a recovery probe (web: the project list). */
  probe(user: TUser): Promise<unknown>;
  /** Unsaved drafts; the previous account's are dropped on an account switch. */
  drafts: DraftStorage;
}

/**
 * Session coordinator shared by web and mobile (docs/state-and-cache.md): one session revision,
 * store reset per UID, offline restore before the network load, and the BG-012 rules (offline
 * startup opens the shell; network-only failures never block a ready session).
 */
export function createSessionCoordinator<TUser extends SessionUser>({
  resetStores,
  loadStores,
  probe,
  drafts,
}: SessionCoordinatorOptions<TUser>) {
  const sessionStore = createStore<SessionState>()(() => ({
    uid: null,
    status: 'idle',
    error: null,
  }));
  let loading: Promise<void> | null = null;

  function resetSession(uid: string | null) {
    const previous = sessionUid();
    if (previous && previous !== uid) void deleteOfflineUserData(previous);
    setSessionUid(uid);
    withOfflinePersistenceSuspended(() => {
      clearMemoryResources();
      resetStores();
      syncStore.setState({ jobs: {} });
    });
    if (previous && previous !== uid) {
      try {
        for (const key of drafts.keys(`${DRAFT_KEY_PREFIX}:${previous}:`)) drafts.removeItem(key);
      } catch {
        /* Private mode. */
      }
    }
    loading = null;
    sessionStore.setState({ uid, status: 'idle', error: null });
  }

  function loadSession(user: TUser, retry = false, writesAlreadyFlushed = false): Promise<void> {
    if (sessionUid() !== user.uid) resetSession(user.uid);
    if (loading) return loading;
    if (sessionStore.getState().status === 'ready' && !retry) return Promise.resolve();
    const revision = sessionRevision();
    const sessionWasReady = sessionStore.getState().status === 'ready';
    if (!sessionWasReady) sessionStore.setState({ uid: user.uid, status: 'loading', error: null });
    loading = (async () => {
      try {
        if (!sessionWasReady)
          await Promise.all([
            restoreOfflineStores(user.uid),
            restorePersistedMemoryResources(user.uid),
          ]);
        if (!isSessionCurrent(user.uid, revision)) return;
        if (isBrowserDisconnected()) {
          sessionStore.setState({ uid: user.uid, status: 'ready', error: null });
          return;
        }
        if (retry && !writesAlreadyFlushed) {
          await withTimeout(flushWrites());
          if (hasPendingWrites()) throw new Error('Hay cambios pendientes de sincronizar.');
        }
        await withTimeout(loadStores(user));
        if (isSessionCurrent(user.uid, revision)) {
          markNetworkAvailable('session');
          sessionStore.setState({ status: 'ready' });
        }
      } catch (error) {
        if (isSessionCurrent(user.uid, revision)) {
          const offline = reportNetworkUnavailable(error);
          sessionStore.setState({
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

  async function probeSessionConnection(user: TUser): Promise<boolean> {
    if (isBrowserDisconnected()) return false;
    try {
      await withTimeout(probe(user));
      markNetworkAvailable('request');
      return true;
    } catch (error) {
      reportNetworkUnavailable(error);
      return false;
    }
  }

  async function prepareSignOut() {
    await withTimeout(flushWrites());
  }

  return { sessionStore, resetSession, loadSession, probeSessionConnection, prepareSignOut };
}
