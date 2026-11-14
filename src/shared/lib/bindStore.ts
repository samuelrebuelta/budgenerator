import { useStore, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * Binds a vanilla store of `@bg/app-core` to React with the web's own `zustand`, exactly as
 * `create()` does: the hook plus `getState`/`setState`/`subscribe` of the same store.
 */
export function bindStore<TStore extends StoreApi<unknown>>(api: TStore): UseBoundStore<TStore> {
  const useBoundStore = ((selector?: (state: unknown) => unknown) =>
    useStore(api, selector as (state: unknown) => unknown)) as UseBoundStore<TStore>;
  Object.assign(useBoundStore, api);
  return useBoundStore;
}
