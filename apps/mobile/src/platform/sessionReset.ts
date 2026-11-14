import { getAuth, signOut } from '@react-native-firebase/auth';
import { clearPersistence, getFirestore, terminate } from '@react-native-firebase/firestore';
import { connectFirestoreToEmulator } from './firebase';
import { deleteUserStorage } from './userStorage';

/**
 * Native operations that `resetSession` runs, injectable for tests. The order matters:
 * Firestore only clears its disk cache once terminated, and React Native Firebase drops the
 * native instance (and its emulator binding) on `terminate`, so development has to attach the
 * emulator again before the next read (spike D3, docs/specs/plans/2026-11-14-bg-014-spikes.md).
 */
export interface SessionResetPort {
  terminateFirestore(): Promise<void>;
  clearFirestorePersistence(): Promise<void>;
  /** Development: binds the fresh Firestore instance to the emulator again. */
  reattachFirestore(): void;
  deleteUserStorage(uid: string): void;
  signOut(): Promise<void>;
}

export const nativeSessionResetPort: SessionResetPort = {
  terminateFirestore: () => terminate(getFirestore()),
  clearFirestorePersistence: () => clearPersistence(getFirestore()),
  reattachFirestore: connectFirestoreToEmulator,
  deleteUserStorage: (uid) => {
    deleteUserStorage(uid);
  },
  // RNFB rejects `signOut` without a user (auth/no-current-user), unlike the web SDK.
  signOut: async () => {
    const auth = getAuth();
    if (auth.currentUser) await signOut(auth);
  },
};

export type SessionResetStep =
  | 'terminateFirestore'
  | 'clearFirestorePersistence'
  | 'reattachFirestore'
  | 'deleteUserStorage'
  | 'signOut';

export class SessionResetError extends Error {
  constructor(readonly failures: { step: SessionResetStep; error: unknown }[]) {
    super(
      `No se ha podido borrar por completo la sesión anterior (${failures
        .map(({ step }) => step)
        .join(', ')}).`,
    );
    this.name = 'SessionResetError';
  }
}

/**
 * Closes the session without leaving the previous account's data on the device (BG-014 D3,
 * BG-012 criterion 7): Firestore `terminate` + `clearPersistence`, MMKV of the UID and sign-out.
 * Every step runs even if an earlier one fails, and sign-out always runs last; failures are
 * reported together so the caller can block the next sign-in until the device is clean.
 * Phase 1 adds the earlier steps of `prepareSignOut` (push device, FCM token, WriteQueue).
 */
export async function resetSession(
  uid: string | null,
  port: SessionResetPort = nativeSessionResetPort,
): Promise<void> {
  const failures: { step: SessionResetStep; error: unknown }[] = [];
  const run = async (step: SessionResetStep, action: () => unknown) => {
    try {
      await action();
    } catch (error) {
      failures.push({ step, error });
    }
  };

  await run('terminateFirestore', () => port.terminateFirestore());
  // Clearing needs a terminated instance; skip it if terminate failed (it would throw anyway).
  if (!failures.length)
    await run('clearFirestorePersistence', () => port.clearFirestorePersistence());
  await run('reattachFirestore', () => port.reattachFirestore());
  if (uid) await run('deleteUserStorage', () => port.deleteUserStorage(uid));
  await run('signOut', () => port.signOut());

  if (failures.length) throw new SessionResetError(failures);
}
