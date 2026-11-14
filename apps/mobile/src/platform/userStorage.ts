import { createMMKV, deleteMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Per-account MMKV storage (store snapshots, last tab…; BG-014 §3.7). One instance per UID so
 * that closing a session can drop everything that account left on the device (D3).
 */
const instances = new Map<string, MMKV>();

export function userStorageId(uid: string): string {
  if (!uid || uid.includes('/'))
    throw new Error('El usuario del almacenamiento local no es válido.');
  return `user.${uid}`;
}

export function userStorage(uid: string): MMKV {
  const id = userStorageId(uid);
  let storage = instances.get(id);
  if (!storage) {
    storage = createMMKV({ id });
    instances.set(id, storage);
  }
  return storage;
}

/**
 * Empties and deletes the UID's MMKV files. `clearAll` covers the open instance (and Jest's
 * in-memory mock); `deleteMMKV` removes the files on disk. Returns whether the files are gone.
 */
export function deleteUserStorage(uid: string): boolean {
  const id = userStorageId(uid);
  const storage = instances.get(id) ?? createMMKV({ id });
  storage.clearAll();
  instances.delete(id);
  return deleteMMKV(id);
}
