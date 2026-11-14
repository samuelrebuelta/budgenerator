import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { KeyValueStore, OfflineEntry } from '@bg/app-core/ports';
import { existingUserStorage, userStorage } from './userStorage';

/**
 * Keys of the shared offline cache that belong to an account: `session:{uid}:…` (store
 * snapshots) and `resource:private:{uid}:…` (route resources). They go to that UID's MMKV, so
 * `resetSession` (D3) drops them with `deleteUserStorage`; anything else goes to a shared file.
 */
const ACCOUNT_PREFIXES = ['session:', 'resource:private:'] as const;

export function accountOfKey(key: string): string | null {
  for (const prefix of ACCOUNT_PREFIXES) {
    if (!key.startsWith(prefix)) continue;
    const uid = key.slice(prefix.length).split(':')[0];
    return uid && !uid.includes('/') ? uid : null;
  }
  return null;
}

let sharedStorage: MMKV | null = null;
function shared(): MMKV {
  sharedStorage ??= createMMKV({ id: 'offline-state' });
  return sharedStorage;
}

/** Storage that receives a write: the account's (created if needed) or the shared one. */
function storageFor(key: string): MMKV {
  const uid = accountOfKey(key);
  return uid ? userStorage(uid) : shared();
}

/**
 * Storages a read or a delete can reach: the account's when the key or prefix names one and it
 * still exists (never recreated after `resetSession`), otherwise the shared one.
 */
function storagesFor(prefix: string): MMKV[] {
  const uid = accountOfKey(prefix);
  if (!uid) return [shared()];
  const storage = existingUserStorage(uid);
  return storage ? [storage] : [];
}

function parse(raw: string | undefined): OfflineEntry | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as OfflineEntry;
  } catch {
    return undefined;
  }
}

/**
 * MMKV `KeyValueStore` of `@bg/app-core`'s offline cache (BG-014 §3.3): same `{ key, value,
 * savedAt }` entries as the web's IndexedDB, serialised as JSON. MMKV is synchronous; the port is
 * async so both platforms share one cache.
 */
export const mmkvKeyValueStore: KeyValueStore = {
  async get(key) {
    return parse(storagesFor(key)[0]?.getString(key));
  },
  async getAll(prefix) {
    return storagesFor(prefix).flatMap((storage) =>
      storage
        .getAllKeys()
        .filter((key) => key.startsWith(prefix))
        .map((key) => parse(storage.getString(key)))
        .filter((entry): entry is OfflineEntry => entry !== undefined),
    );
  },
  async getAllKeys(prefix) {
    return storagesFor(prefix).flatMap((storage) =>
      storage.getAllKeys().filter((key) => key.startsWith(prefix)),
    );
  },
  async put(entry) {
    storageFor(entry.key).set(entry.key, JSON.stringify(entry));
  },
  async delete(keys) {
    for (const key of keys) for (const storage of storagesFor(key)) storage.remove(key);
  },
};
