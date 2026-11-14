import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toUserMessage } from '@bg/domain/lib/errors';
import { coordinator, useAuthStore } from '../state/stores';
import { SessionContext, type Session } from './context';
import { reconcileDeviceSession } from './deviceSession';

/**
 * Mobile counterpart of the web's `App` session effects: one auth subscription (`@bg/app-core`
 * auth store over RNFB), the D3 device check on every account change and then the shared
 * coordinator (`loadSession` / `resetSession`).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const [resolved, setResolved] = useState(false);
  /** Result of the D3 check for an account: ready, or the error that blocks it. */
  const [device, setDevice] = useState<{ uid: string | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `loading` also turns on while signing in; only the first auth answer resolves the session.
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.loading) setResolved(true);
    });
    const stop = useAuthStore.getState().init();
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  useEffect(() => {
    if (!resolved) return;
    let current = true;
    reconcileDeviceSession(uid).then(
      () => {
        if (!current) return;
        setDevice({ uid, error: null });
        const user = useAuthStore.getState().user;
        if (user && user.uid === uid) void coordinator.loadSession(user);
        else coordinator.resetSession(null);
      },
      (error: unknown) => {
        if (!current) return;
        setDevice({
          uid,
          error: toUserMessage(
            error,
            'No se ha podido borrar la sesión anterior de este dispositivo.',
          ),
        });
      },
    );
    return () => {
      current = false;
    };
  }, [resolved, uid, attempt]);

  const retryReset = useCallback(() => setAttempt((value) => value + 1), []);
  const current = device?.uid === uid ? device : null;
  const value = useMemo<Session>(
    () => ({
      status: !resolved ? 'loading' : uid ? 'signedIn' : 'signedOut',
      uid,
      deviceReady: resolved && current !== null && current.error === null,
      resetError: current?.error ?? null,
      retryReset,
    }),
    [resolved, uid, current, retryReset],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}
