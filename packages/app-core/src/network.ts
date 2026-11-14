import { createStore } from 'zustand/vanilla';
import type { ConnectivityPort } from './ports.js';
import { scheduleFlushWrites } from './sync.js';
import { resetOfflineMutationToast } from './toast.js';

export interface NetworkState {
  online: boolean;
  browserOnline: boolean;
  recoveryVersion: number;
  recoverySource: 'browser' | 'request' | 'session' | null;
  dataRefreshVersion: number;
  refreshedRecoveryVersion: number;
}

/** Until the platform sets its port the device state is unknown (the store starts online). */
let connectivity: ConnectivityPort = { isOnline: () => undefined };

function browserIsOnline(): boolean | undefined {
  return connectivity.isOnline();
}

/** Network state of the app; the web binds it as `useNetworkStore`. */
export const networkStore = createStore<NetworkState>()(() => {
  const online = browserIsOnline() ?? true;
  return {
    online,
    browserOnline: online,
    recoveryVersion: 0,
    recoverySource: null,
    dataRefreshVersion: 0,
    refreshedRecoveryVersion: 0,
  };
});

/**
 * Installs the platform connectivity (web: `navigator.onLine`, mobile: NetInfo) and takes its
 * current value as the initial state. Call it once at startup, before the first mutation.
 */
export function setConnectivityPort(port: ConnectivityPort) {
  connectivity = port;
  const online = port.isOnline();
  if (online !== undefined) networkStore.setState({ online, browserOnline: online });
}

/** Forwards the port's change feed to `setNetworkOnline`; returns the unsubscribe function. */
export function watchConnectivity(): () => void {
  return connectivity.subscribe?.((online) => setNetworkOnline(online)) ?? (() => undefined);
}

export function setNetworkOnline(online: boolean) {
  const current = networkStore.getState();
  const recovered = online && (!current.online || !current.browserOnline);
  networkStore.setState({
    online,
    browserOnline: online,
    ...(recovered
      ? { recoveryVersion: current.recoveryVersion + 1, recoverySource: 'browser' as const }
      : {}),
  });
  if (online) {
    resetOfflineMutationToast();
    if (recovered) scheduleFlushWrites();
  }
}

export function markNetworkAvailable(source: 'request' | 'session' = 'request') {
  const current = networkStore.getState();
  const browserOnline = browserIsOnline();
  if (browserOnline === false || (browserOnline === undefined && !current.browserOnline)) return;
  const recovered = !current.online || !current.browserOnline;
  networkStore.setState({
    online: true,
    ...(browserOnline ? { browserOnline: true } : {}),
    ...(recovered ? { recoveryVersion: current.recoveryVersion + 1, recoverySource: source } : {}),
  });
  resetOfflineMutationToast();
  if (recovered) scheduleFlushWrites();
}

export function completeRecoveryRefresh(recoveryVersion = networkStore.getState().recoveryVersion) {
  networkStore.setState((current) => {
    if (recoveryVersion <= current.refreshedRecoveryVersion) return current;
    return {
      dataRefreshVersion: current.dataRefreshVersion + 1,
      refreshedRecoveryVersion: recoveryVersion,
    };
  });
}

export function isNetworkUnavailable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '';
  if (
    code === 'unavailable' ||
    code === 'functions/unavailable' ||
    code === 'network-request-failed'
  )
    return true;
  if (typeof candidate.message !== 'string') return false;
  return /fetch|network|offline|connection|conexión|no connection|load failed/i.test(
    candidate.message,
  );
}

export function reportNetworkUnavailable(error: unknown) {
  if (!isNetworkUnavailable(error)) return false;
  networkStore.setState({ online: false });
  return true;
}

export function isBrowserDisconnected() {
  const state = networkStore.getState();
  const browserOnline = browserIsOnline();
  return browserOnline === undefined ? !state.browserOnline : !browserOnline;
}
