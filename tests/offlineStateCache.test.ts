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
