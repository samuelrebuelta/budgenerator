import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionCoordinator, type SessionUser } from '../src/sessionCoordinator';
import {
  configureOfflineStorage,
  readOfflineValue,
  writeOfflineValue,
} from '../src/offlineStateCache';
import { getMemoryResource, setMemoryResource } from '../src/memoryResourceCache';
import { networkStore, setConnectivityPort, setNetworkOnline } from '../src/network';
import { sessionUid } from '../src/session';
import { memoryDraftStorage, memoryKeyValueStore } from './memoryPorts';

const alice: SessionUser = { uid: 'alice', email: 'alice@example.test' };

function coordinator(overrides: { loadStores?: () => Promise<unknown> } = {}) {
  const { drafts, items } = memoryDraftStorage();
  const resetStores = vi.fn();
  const loadStores = vi.fn(overrides.loadStores ?? (async () => undefined));
  const probe = vi.fn(async () => undefined);
  const session = createSessionCoordinator({ resetStores, loadStores, probe, drafts });
  return { session, items, resetStores, loadStores, probe };
}

describe('coordinador de sesión compartido', () => {
  beforeEach(() => {
    configureOfflineStorage(memoryKeyValueStore().store);
    setConnectivityPort({ isOnline: () => true });
    setNetworkOnline(true);
  });

  it('al cambiar de cuenta borra datos offline, recursos y borradores de la anterior', async () => {
    const { session, items, resetStores } = coordinator();
    session.resetSession('alice');
    items.set('cimbra-draft:alice:budget', '{}');
    items.set('cimbra-draft:bob:budget', '{}');
    await writeOfflineValue('session:alice:projects', { projects: [] });
    setMemoryResource('private:alice:leads', []);

    session.resetSession('bob');
    await vi.waitFor(async () =>
      expect(await readOfflineValue('session:alice:projects')).toBeUndefined(),
    );

    expect(sessionUid()).toBe('bob');
    expect(getMemoryResource('private:alice:leads')).toBeUndefined();
    expect([...items.keys()]).toEqual(['cimbra-draft:bob:budget']);
    expect(resetStores).toHaveBeenCalledTimes(2);
    expect(session.sessionStore.getState()).toEqual({ uid: 'bob', status: 'idle', error: null });
  });

  it('carga las stores y queda lista; sin red abre el shell con lo restaurado', async () => {
    const online = coordinator();
    await online.session.loadSession(alice);
    expect(online.loadStores).toHaveBeenCalledWith(alice);
    expect(online.session.sessionStore.getState().status).toBe('ready');

    setConnectivityPort({ isOnline: () => false });
    const offline = coordinator();
    offline.session.resetSession(null);
    await offline.session.loadSession(alice);
    expect(offline.loadStores).not.toHaveBeenCalled();
    expect(offline.session.sessionStore.getState().status).toBe('ready');
    await expect(offline.session.probeSessionConnection(alice)).resolves.toBe(false);
  });

  it('un fallo sólo de red deja la sesión lista y marca la app sin conexión', async () => {
    const { session } = coordinator({
      loadStores: () =>
        Promise.reject(Object.assign(new Error('offline'), { code: 'unavailable' })),
    });
    session.resetSession(null);
    await session.loadSession(alice);
    expect(session.sessionStore.getState()).toMatchObject({ status: 'ready', error: null });
    expect(networkStore.getState().online).toBe(false);
  });
});
