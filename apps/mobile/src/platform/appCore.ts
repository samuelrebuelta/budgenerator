import { setConnectivityPort, watchConnectivity } from '@bg/app-core/network';
import { configureOfflineStorage } from '@bg/app-core/offlineStateCache';
import { netInfoConnectivity } from './connectivity';
import { mmkvKeyValueStore } from './keyValueStore';
import { appStateLifecycle } from './lifecycle';

let installed: (() => void) | null = null;

/**
 * Installs the native adapters of the `@bg/app-core` ports (NetInfo, MMKV, AppState) once, before
 * the shared stores restore or write anything. Returns the function that stops NetInfo.
 */
export function installNativePlatform(): () => void {
  if (installed) return installed;
  setConnectivityPort(netInfoConnectivity);
  configureOfflineStorage(mmkvKeyValueStore, { lifecycle: appStateLifecycle });
  const stop = watchConnectivity();
  installed = () => {
    stop();
    installed = null;
  };
  return installed;
}

export { mmkvDraftStorage } from './draftStorage';
export { manipulatorLogoNormalizer, type PickedImage } from './imageNormalizer';
