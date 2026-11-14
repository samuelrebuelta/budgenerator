import { createContext, use } from 'react';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface Session {
  status: SessionStatus;
  uid: string | null;
}

export const SessionContext = createContext<Session>({ status: 'loading', uid: null });

export function useSession(): Session {
  return use(SessionContext);
}
