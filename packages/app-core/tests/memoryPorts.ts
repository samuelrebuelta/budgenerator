import type { DraftStorage, KeyValueStore, OfflineEntry } from '../src/ports';

/** `KeyValueStore` over a Map, like MMKV or IndexedDB for the shared cache. */
export function memoryKeyValueStore(entries = new Map<string, OfflineEntry>()) {
  const store: KeyValueStore = {
    get: async (key) => entries.get(key),
    getAll: async (prefix) => [...entries.values()].filter((entry) => entry.key.startsWith(prefix)),
    getAllKeys: async (prefix) => [...entries.keys()].filter((key) => key.startsWith(prefix)),
    put: async (entry) => void entries.set(entry.key, entry),
    delete: async (keys) => keys.forEach((key) => entries.delete(key)),
  };
  return { store, entries };
}

export function memoryDraftStorage(items = new Map<string, string>()) {
  const drafts: DraftStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    keys: (prefix) => [...items.keys()].filter((key) => key.startsWith(prefix)),
  };
  return { drafts, items };
}
