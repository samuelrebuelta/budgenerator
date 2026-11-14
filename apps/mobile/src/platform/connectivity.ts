import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { ConnectivityPort } from '@bg/app-core/ports';

/** Online when connected and the internet is not known to be unreachable (captive portals). */
export function isOnlineState(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  if (state.isConnected === null) return undefined;
  return state.isConnected && state.isInternetReachable !== false;
}

let lastKnown: boolean | undefined;

/**
 * NetInfo as `@bg/app-core`'s `ConnectivityPort`. NetInfo only reports asynchronously, so the
 * port answers with the last state it saw (`undefined` before the first event) and
 * `watchConnectivity()` forwards each change to the network store, like `online`/`offline` on web.
 */
export const netInfoConnectivity: ConnectivityPort = {
  isOnline: () => lastKnown,
  subscribe(listener) {
    return NetInfo.addEventListener((state) => {
      const online = isOnlineState(state);
      if (online === undefined || online === lastKnown) return;
      lastKnown = online;
      listener(online);
    });
  },
};
