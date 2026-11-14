import { createContext, use } from 'react';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface Session {
  status: SessionStatus;
  uid: string | null;
  /** The device holds only this account's data (previous account wiped, D3). */
  deviceReady: boolean;
  /** The previous account could not be wiped; the session stays blocked until a retry works. */
  resetError: string | null;
  retryReset: () => void;
}

export const SessionContext = createContext<Session>({
  status: 'loading',
  uid: null,
  deviceReady: false,
  resetError: null,
  retryReset: () => undefined,
});

export function useSession(): Session {
  return use(SessionContext);
}
