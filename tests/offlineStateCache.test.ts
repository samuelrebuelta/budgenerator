import { create } from 'zustand';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOfflineUserData,
  readOfflineValue,
  registerOfflineStore,
  restoreOfflineStores,
  withOfflinePersistenceSuspended,
  waitForOfflinePersistence,
  writeOfflineValue,
} from '../src/shared/lib/offlineStateCache';
import { setSessionUid, sessionUid } from '../src/shared/model/session';

const testUid = 'offline-cache-test-user';
const store = create<{ value: string; update: (value: string) => void }>((set) => ({
  value: 'initial',
  update: (value) => set({ value }),
}));

registerOfflineStore('offline-cache-test', store, sessionUid, (state) => ({
  value: state.value,
}));

describe('offline state cache', () => {
  beforeEach(async () => {
    await waitForOfflinePersistence();
    await deleteOfflineUserData(testUid);
    setSessionUid(testUid);
    store.setState({ value: 'initial' });
  });

  it('restores only the saved account snapshot', async () => {
    store.getState().update('Cuenta A');
    await waitForOfflinePersistence();

    setSessionUid('another-offline-cache-user');
    store.getState().update('Cuenta B');
    await waitForOfflinePersistence();

    setSessionUid(testUid);
    withOfflinePersistenceSuspended(() => store.setState({ value: 'initial' }));
    await restoreOfflineStores(testUid);

    expect(store.getState().value).toBe('Cuenta A');
  });

  it('writes the first change at once and coalesces the following ones', async () => {
    store.getState().update('Cuenta A');
    await waitForOfflinePersistence();
    store.getState().update('B');
    store.getState().update('BC');
    store.getState().update('BCD');

    await expect(readOfflineValue(`session:${testUid}:offline-cache-test`)).resolves.toEqual({
      value: 'B',
    });
    await waitForOfflinePersistence();
    await expect(readOfflineValue(`session:${testUid}:offline-cache-test`)).resolves.toEqual({
      value: 'BCD',
    });
  });

  it('discards a pending snapshot when the account changes', async () => {
    store.getState().update('Cuenta A');
    await waitForOfflinePersistence();
    store.getState().update('Primera');
    store.getState().update('Pendiente');
    setSessionUid('another-offline-cache-user');
    await waitForOfflinePersistence();
    setSessionUid(testUid);

    await expect(readOfflineValue(`session:${testUid}:offline-cache-test`)).resolves.toEqual({
      value: 'Primera',
    });
  });

  it('clears one account cache without removing another account data', async () => {
    await writeOfflineValue(`resource:private:${testUid}:project:one`, { id: 'one' });
    await writeOfflineValue('resource:private:another-user:project:two', { id: 'two' });

    await deleteOfflineUserData(testUid);

    await expect(
      readOfflineValue(`resource:private:${testUid}:project:one`),
    ).resolves.toBeUndefined();
    await expect(readOfflineValue('resource:private:another-user:project:two')).resolves.toEqual({
      id: 'two',
    });
  });
});
