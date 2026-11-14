import '@/shared/platform/connectivity';
import { networkStore } from '@bg/app-core/network';
import { bindStore } from '@/shared/lib/bindStore';

export {
  setNetworkOnline,
  markNetworkAvailable,
  completeRecoveryRefresh,
  isNetworkUnavailable,
  reportNetworkUnavailable,
  isBrowserDisconnected,
  setConnectivityPort,
  watchConnectivity,
  type NetworkState,
} from '@bg/app-core/network';

export const useNetworkStore = bindStore(networkStore);
