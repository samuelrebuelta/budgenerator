import { create } from 'zustand';
import { scheduleFlushWrites } from './sync';
import { resetOfflineMutationToast } from './toast';

interface NetworkState {
  online: boolean;
  browserOnline: boolean;
  recoveryVersion: number;
  recoverySource: 'browser' | 'request' | 'session' | null;
  dataRefreshVersion: number;
  refreshedRecoveryVersion: number;
}

function browserIsOnline(): boolean | undefined {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return undefined;
  return navigator.onLine;
}

export const useNetworkStore = create<NetworkState>(() => {
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

export function setNetworkOnline(online: boolean) {
  const current = useNetworkStore.getState();
  const recovered = online && (!current.online || !current.browserOnline);
  useNetworkStore.setState({
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
  const current = useNetworkStore.getState();
  const browserOnline = browserIsOnline();
  if (browserOnline === false || (browserOnline === undefined && !current.browserOnline)) return;
  const recovered = !current.online || !current.browserOnline;
  useNetworkStore.setState({
    online: true,
    ...(browserOnline ? { browserOnline: true } : {}),
    ...(recovered ? { recoveryVersion: current.recoveryVersion + 1, recoverySource: source } : {}),
  });
  resetOfflineMutationToast();
  if (recovered) scheduleFlushWrites();
}

export function completeRecoveryRefresh(
  recoveryVersion = useNetworkStore.getState().recoveryVersion,
) {
  useNetworkStore.setState((current) => {
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
  useNetworkStore.setState({ online: false });
  return true;
}

export function isBrowserDisconnected() {
  const state = useNetworkStore.getState();
  const browserOnline = browserIsOnline();
  return browserOnline === undefined ? !state.browserOnline : !browserOnline;
}
