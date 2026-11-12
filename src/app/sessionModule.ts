import { isBrowserDisconnected, markNetworkAvailable } from '@/shared/model/network';

/**
 * The authenticated session (Firestore, entity stores and their offline snapshots) is loaded
 * on demand so public routes and `/login` only download Auth and their own page.
 */
type SessionModule = typeof import('./session');

let pending: Promise<SessionModule> | null = null;
let loaded: SessionModule | null = null;

export function loadSessionModule(): Promise<SessionModule> {
  pending ??= import('./session').then((module) => (loaded = module));
  return pending;
}

/** Returns the session module only when it has already been loaded. */
export function loadedSessionModule(): SessionModule | null {
  return loaded;
}

export function retryUnauthenticatedRouteConnection(): boolean {
  if (isBrowserDisconnected()) return false;
  // The active public route is the Firebase probe; this starts its cached, non-blocking reload.
  markNetworkAvailable('request');
  return true;
}
