import type { KeyValueStore, OfflineEntry } from '@bg/app-core/ports';

const databaseName = 'budgenerator-offline-state';
const objectStoreName = 'entries';
let database: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (database) return database;

  const opening = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName))
          request.result.createObjectStore(objectStoreName, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }).then((result) => {
    if (!result) database = null;
    return result;
  });
  database = opening;
  return opening;
}

function prefixRange(prefix: string) {
  return IDBKeyRange.bound(prefix, `${prefix}￿`);
}

function read<T>(fallback: T, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve) => {
        if (!db) return resolve(fallback);
        try {
          const request = run(
            db.transaction(objectStoreName, 'readonly').objectStore(objectStoreName),
          );
          request.onsuccess = () => resolve((request.result as T) ?? fallback);
          request.onerror = () => resolve(fallback);
        } catch {
          resolve(fallback);
        }
      }),
  );
}

function write(run: (store: IDBObjectStore) => void): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
          const transaction = db.transaction(objectStoreName, 'readwrite');
          run(transaction.objectStore(objectStoreName));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
          transaction.onabort = () => resolve();
        } catch {
          resolve();
        }
      }),
  );
}

/**
 * IndexedDB `KeyValueStore` of the offline snapshots (BG-012), with the same database, object
 * store and `{ key, value, savedAt }` records as before BG-014, so existing caches stay valid.
 * Every operation resolves: without IndexedDB the shared cache keeps its in-memory copy.
 */
export const indexedDbStore: KeyValueStore = {
  get: (key) => read<OfflineEntry | undefined>(undefined, (store) => store.get(key)),
  getAll: (prefix) => read<OfflineEntry[]>([], (store) => store.getAll(prefixRange(prefix))),
  getAllKeys: (prefix) =>
    read<IDBValidKey[]>([], (store) => store.getAllKeys(prefixRange(prefix))).then((keys) =>
      keys.filter((key): key is string => typeof key === 'string'),
    ),
  put: (entry) => write((store) => store.put(entry)),
  delete: (keys) => write((store) => keys.forEach((key) => store.delete(key))),
};
