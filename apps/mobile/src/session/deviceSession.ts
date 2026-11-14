import { createMMKV, type MMKV } from 'react-native-mmkv';
import { getAuth } from '@react-native-firebase/auth';
import { sessionUid } from '@bg/app-core/session';
import { resetSession } from '../platform/sessionReset';
import { coordinator } from '../state/stores';

/**
 * UID of the account whose data this device holds (Firestore disk cache and its MMKV). It lives
 * in its own MMKV, outside every account's storage, so a session that ended without our sign-out
 * (token revoked, app killed mid sign-out) is still wiped on the next auth change (D3).
 */
const LAST_UID_KEY = 'session.lastUid';
let deviceState: MMKV | null = null;
function state(): MMKV {
  deviceState ??= createMMKV({ id: 'device-session' });
  return deviceState;
}

export function deviceSessionUid(): string | null {
  return state().getString(LAST_UID_KEY) ?? null;
}

/** Sign-out and auth changes run one after another, never interleaved. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Called on every auth change before the session loads. If the device still holds another
 * account's data, wipes it (`terminate` + `clearPersistence` + its MMKV) without signing out the
 * account that is now signed in. Throws `SessionResetError` so the guard blocks the new session
 * until the device is clean; the UID stays recorded so the next attempt wipes it again.
 */
export function reconcileDeviceSession(nextUid: string | null): Promise<void> {
  return serial(async () => {
    const previous = deviceSessionUid();
    if (previous && previous !== nextUid)
      await resetSession(previous, undefined, { signOut: false });
    if (nextUid) state().set(LAST_UID_KEY, nextUid);
    else state().remove(LAST_UID_KEY);
  });
}

/**
 * Native sign-out (web: `prepareSignOut` + `signOut` in `AppShell`, BG-014 §4.4 and D3):
 * 1. flush the WriteQueue (fails with pending changes, as on the web);
 * 2. reset the in-memory stores and drop the account's offline snapshots and drafts;
 * 3. `resetSession` nativo: Firestore `terminate` + `clearPersistence`, the UID's MMKV and the
 *    Auth sign-out. TODO(BG-014 fase 2): revoke the push device and delete the FCM token first.
 */
export function signOutAndWipe(): Promise<void> {
  return serial(async () => {
    const uid = getAuth().currentUser?.uid ?? sessionUid() ?? deviceSessionUid();
    await coordinator.prepareSignOut();
    coordinator.resetSession(null);
    await resetSession(uid);
    state().remove(LAST_UID_KEY);
  });
}
