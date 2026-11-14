import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  configureOfflineStorage,
  deleteOfflineUserData,
  readOfflineValue,
  registerOfflineStore,
  restoreOfflineStores,
  waitForOfflinePersistence,
  withOfflinePersistenceSuspended,
  writeOfflineValue,
} from '../src/offlineStateCache';
import {
  isBrowserDisconnected,
  networkStore,
  setConnectivityPort,
  watchConnectivity,
} from '../src/network';
import { setSessionUid, sessionUid } from '../src/session';
import type { KeyValueStore } from '../src/ports';
import { memoryKeyValueStore } from './memoryPorts';

describe('KeyValueStore', () => {
  beforeEach(() => setSessionUid('alice'));

  it('persiste las instantáneas en el almacén de la plataforma y las restaura por cuenta', async () => {
    const { store: kv, entries } = memoryKeyValueStore();
    const background: (() => void)[] = [];
    configureOfflineStorage(kv, { lifecycle: { onBackground: (flush) => background.push(flush) } });
    const store = createStore<{ value: string }>()(() => ({ value: 'inicial' }));
    registerOfflineStore('ports-test', store, sessionUid, (state) => ({ value: state.value }));

    store.setState({ value: 'Cuenta A' });
    await waitForOfflinePersistence();
    expect(entries.get('session:alice:ports-test')?.value).toEqual({ value: 'Cuenta A' });
    expect(background).toHaveLength(1);

    withOfflinePersistenceSuspended(() => store.setState({ value: 'otra cosa' }));
    await restoreOfflineStores('alice');
    expect(store.getState().value).toBe('Cuenta A');

    await deleteOfflineUserData('alice');
    expect([...entries.keys()]).toEqual([]);
  });

  it('si el almacén falla, la sesión sigue con la copia en memoria', async () => {
    const failing: KeyValueStore = {
      get: () => Promise.reject(new Error('disk')),
      getAll: () => Promise.reject(new Error('disk')),
      getAllKeys: () => Promise.reject(new Error('disk')),
      put: () => Promise.reject(new Error('disk')),
      delete: () => Promise.reject(new Error('disk')),
    };
    configureOfflineStorage(failing);
    await writeOfflineValue('resource:private:alice:x', { id: 'x' });
    await expect(readOfflineValue('resource:private:alice:x')).resolves.toEqual({ id: 'x' });
    await deleteOfflineUserData('alice');
    await expect(readOfflineValue('resource:private:alice:x')).resolves.toBeUndefined();
    configureOfflineStorage(null);
  });
});

describe('ConnectivityPort', () => {
  it('toma el estado inicial del puerto y reenvía sus cambios', () => {
    let listener: ((online: boolean) => void) | undefined;
    let online: boolean | undefined = false;
    const unsubscribe = vi.fn();
    setConnectivityPort({
      isOnline: () => online,
      subscribe: (next) => {
        listener = next;
        return unsubscribe;
      },
    });
    expect(networkStore.getState()).toMatchObject({ online: false, browserOnline: false });
    expect(isBrowserDisconnected()).toBe(true);

    const stop = watchConnectivity();
    online = true;
    listener?.(true);
    expect(networkStore.getState()).toMatchObject({ online: true, recoverySource: 'browser' });
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();

    // Unknown connectivity keeps the last state the app saw.
    online = undefined;
    expect(isBrowserDisconnected()).toBe(false);
  });
});
