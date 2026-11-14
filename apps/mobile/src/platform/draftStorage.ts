import { DRAFT_KEY_PREFIX } from '@bg/app-core/stores/budget';
import type { DraftStorage } from '@bg/app-core/ports';
import { userStorage } from './userStorage';

/** Drafts are keyed `cimbra-draft:{uid}:{draftKey}` and live in the UID's MMKV (D3). */
function uidOf(key: string): string {
  const uid = key.startsWith(`${DRAFT_KEY_PREFIX}:`)
    ? key.slice(DRAFT_KEY_PREFIX.length + 1).split(':')[0]
    : undefined;
  if (!uid || uid === 'null') throw new Error('El borrador no pertenece a ninguna cuenta.');
  return uid;
}

/**
 * Unsaved budget drafts in MMKV (the web uses `sessionStorage`). They survive an app restart,
 * unlike a browser tab, and `resetSession` deletes them with the rest of the account.
 */
export const mmkvDraftStorage: DraftStorage = {
  getItem: (key) => userStorage(uidOf(key)).getString(key) ?? null,
  setItem: (key, value) => userStorage(uidOf(key)).set(key, value),
  removeItem: (key) => {
    userStorage(uidOf(key)).remove(key);
  },
  keys: (prefix) =>
    userStorage(uidOf(prefix))
      .getAllKeys()
      .filter((key) => key.startsWith(prefix)),
};
