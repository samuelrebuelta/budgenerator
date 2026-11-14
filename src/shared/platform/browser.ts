import type { ConnectivityPort, DraftStorage, LifecyclePort } from '@bg/app-core/ports';

/** `navigator.onLine`, read on every call; `undefined` where the browser cannot tell. */
export const browserConnectivity: ConnectivityPort = {
  isOnline() {
    if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return undefined;
    return navigator.onLine;
  },
};

/** Unsaved budget drafts live in `sessionStorage` (per tab); it may throw in private mode. */
export const sessionDraftStorage: DraftStorage = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
  removeItem: (key) => sessionStorage.removeItem(key),
  keys: (prefix) => Object.keys(sessionStorage).filter((key) => key.startsWith(prefix)),
};

/** Pending snapshots are written when the page is hidden or unloaded. */
export const pageLifecycle: LifecyclePort = {
  onBackground(listener) {
    if (typeof window === 'undefined') return;
    window.addEventListener('pagehide', listener);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') listener();
    });
  },
};
