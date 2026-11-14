import { useEffect, useState, type ReactNode } from 'react';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { SessionContext, type Session } from './context';

/**
 * Minimal session for phase 0: one subscription to the native Auth state. Phase 1 replaces it
 * with the shared coordinator of `@bg/app-core` (store reset per UID, session revision).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading', uid: null });
  useEffect(
    () =>
      onAuthStateChanged(getAuth(), (user) =>
        setSession(
          user ? { status: 'signedIn', uid: user.uid } : { status: 'signedOut', uid: null },
        ),
      ),
    [],
  );
  return <SessionContext value={session}>{children}</SessionContext>;
}
