import { existingUserStorage, userStorage } from '../platform/userStorage';
import { DEFAULT_TAB, isTabName, type TabName } from './tabs';

/** Key in the account's MMKV (BG-014 D8); `resetSession` deletes it with the rest (D3). */
export const LAST_TAB_KEY = 'navigation.lastTab';

/** Last tab the account used on this device; Presupuestos the first time. */
export function readLastTab(uid: string | null): TabName {
  if (!uid) return DEFAULT_TAB;
  try {
    const value = existingUserStorage(uid)?.getString(LAST_TAB_KEY);
    return isTabName(value) ? value : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
}

export function saveLastTab(uid: string | null, tab: string) {
  if (!uid || !isTabName(tab)) return;
  try {
    userStorage(uid).set(LAST_TAB_KEY, tab);
  } catch {
    /* Storage unavailable: the app opens in Presupuestos next time. */
  }
}
