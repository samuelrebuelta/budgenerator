import { useStore, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * Binds a vanilla store of `@bg/app-core` to React Native with the app's own `zustand` (and so
 * its React 19.3), exactly as `create()` does. Same helper as the web's `shared/lib/bindStore`.
 */
export function bindStore<TStore extends StoreApi<unknown>>(api: TStore): UseBoundStore<TStore> {
  const useBoundStore = ((selector?: (state: unknown) => unknown) =>
    useStore(api, selector as (state: unknown) => unknown)) as UseBoundStore<TStore>;
  Object.assign(useBoundStore, api);
  return useBoundStore;
}
