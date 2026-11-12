interface OfflineEntry {
  key: string;
  value: unknown;
  savedAt: number;
}

interface PersistedStore<TState> {
  getState: () => TState;
  setState: (state: Partial<TState>) => void;
  subscribe: (listener: (state: TState) => void) => () => void;
}

const databaseName = 'budgenerator-offline-state';
const objectStoreName = 'entries';
const fallbackEntries = new Map<string, OfflineEntry>();
const registrations = new Map<string, (snapshot: Record<string, unknown>) => void>();
const pendingWrites = new Set<Promise<void>>();
let database: Promise<IDBDatabase | null> | null = null;
let persistenceSuspended = 0;

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

function trackWrite(operation: Promise<void>) {
  pendingWrites.add(operation);
  void operation.finally(() => pendingWrites.delete(operation));
  return operation;
}

export function writeOfflineValue(key: string, value: unknown): Promise<void> {
  const entry: OfflineEntry = { key, value, savedAt: Date.now() };
  fallbackEntries.set(key, entry);

  return trackWrite(
    openDatabase().then(
      (db) =>
        new Promise<void>((resolve) => {
          if (!db) return resolve();
          try {
            const transaction = db.transaction(objectStoreName, 'readwrite');
            transaction.objectStore(objectStoreName).put(entry);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
            transaction.onabort = () => resolve();
          } catch {
            resolve();
          }
        }),
    ),
  );
}

export async function readOfflineValue(key: string): Promise<unknown | undefined> {
  const db = await openDatabase();
  if (db) {
    try {
      const entry = await new Promise<OfflineEntry | undefined>((resolve) => {
        const request = db
          .transaction(objectStoreName, 'readonly')
          .objectStore(objectStoreName)
          .get(key);
        request.onsuccess = () => resolve(request.result as OfflineEntry | undefined);
        request.onerror = () => resolve(undefined);
      });
      if (entry) {
        fallbackEntries.set(key, entry);
        return entry.value;
      }
    } catch {
      // Use the current-tab copy when IndexedDB is unavailable.
    }
  }
  return fallbackEntries.get(key)?.value;
}

export async function readOfflineValues(prefix: string): Promise<OfflineEntry[]> {
  const entries = new Map<string, OfflineEntry>();
  const db = await openDatabase();
  if (db) {
    try {
      const stored = await new Promise<OfflineEntry[]>((resolve) => {
        const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
        const request = db
          .transaction(objectStoreName, 'readonly')
          .objectStore(objectStoreName)
          .getAll(range);
        request.onsuccess = () => resolve(request.result as OfflineEntry[]);
        request.onerror = () => resolve([]);
      });
      for (const entry of stored) if (entry.key.startsWith(prefix)) entries.set(entry.key, entry);
    } catch {
      // Continue with the current-tab copy when IndexedDB is unavailable.
    }
  }
  for (const [key, entry] of fallbackEntries) if (key.startsWith(prefix)) entries.set(key, entry);
  return [...entries.values()];
}

export async function deleteOfflineValues(prefix: string): Promise<void> {
  const keys = new Set<string>();
  for (const key of fallbackEntries.keys()) if (key.startsWith(prefix)) keys.add(key);
  const db = await openDatabase();
  if (db) {
    try {
      const storedKeys = await new Promise<IDBValidKey[]>((resolve) => {
        const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
        const request = db
          .transaction(objectStoreName, 'readonly')
          .objectStore(objectStoreName)
          .getAllKeys(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
      for (const key of storedKeys)
        if (typeof key === 'string' && key.startsWith(prefix)) keys.add(key);
    } catch {
      // The in-memory copies are still removed below.
    }
    if (keys.size) {
      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction(objectStoreName, 'readwrite');
          const store = transaction.objectStore(objectStoreName);
          for (const key of keys) store.delete(key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
          transaction.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }
  for (const key of keys) fallbackEntries.delete(key);
}

export async function deleteOfflineValue(key: string): Promise<void> {
  fallbackEntries.delete(key);
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(objectStoreName, 'readwrite');
      transaction.objectStore(objectStoreName).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteOfflineUserData(uid: string): Promise<void> {
  await Promise.all([
    deleteOfflineValues(`session:${uid}:`),
    deleteOfflineValues(`resource:private:${uid}:`),
  ]);
}

/**
 * Store snapshots are throttled per store: the first change is written at once (so data that
 * just arrived from the network is persisted before a reload), and later changes within the
 * window — typing in the editor — are coalesced into one trailing write.
 */
export const OFFLINE_SNAPSHOT_DELAY_MS = 600;

interface SnapshotWindow {
  timer: ReturnType<typeof setTimeout>;
  /** Trailing write for changes made during the window. */
  pending: (() => void) | null;
}

const snapshotWindows = new Map<string, SnapshotWindow>();

function shallowEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown>) {
  if (!a) return false;
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((key) => Object.is(a[key], b[key]));
}

function openSnapshotWindow(key: string) {
  snapshotWindows.set(key, {
    pending: null,
    timer: setTimeout(() => {
      const current = snapshotWindows.get(key);
      snapshotWindows.delete(key);
      if (current?.pending) {
        current.pending();
        openSnapshotWindow(key);
      }
    }, OFFLINE_SNAPSHOT_DELAY_MS),
  });
}

function scheduleSnapshot(key: string, write: () => void) {
  const current = snapshotWindows.get(key);
  if (current) {
    current.pending = write;
    return;
  }
  write();
  openSnapshotWindow(key);
}

/** Writes every pending store snapshot now (before unload, sign-out or tests). */
export function flushOfflineSnapshots() {
  for (const [key, current] of snapshotWindows) {
    clearTimeout(current.timer);
    snapshotWindows.delete(key);
    current.pending?.();
  }
}

let flushListenersInstalled = false;

/** Flushes pending snapshots when the page is hidden or unloaded (installed on first use). */
function installFlushListeners() {
  if (flushListenersInstalled || typeof window === 'undefined') return;
  flushListenersInstalled = true;
  window.addEventListener('pagehide', flushOfflineSnapshots);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOfflineSnapshots();
  });
}

export function registerOfflineStore<TState extends object>(
  key: string,
  store: PersistedStore<TState>,
  getUid: () => string | null,
  select: (state: TState) => Partial<TState>,
) {
  if (registrations.has(key)) return;
  installFlushListeners();
  registrations.set(key, (snapshot) => store.setState(snapshot as Partial<TState>));
  let lastSelection: { uid: string; value: Record<string, unknown> } | undefined;
  store.subscribe((state) => {
    const uid = getUid();
    if (!uid || persistenceSuspended) return;
    const selection = select(state) as Record<string, unknown>;
    // Unrelated store changes (loading flags, UI state) do not rewrite the snapshot.
    if (lastSelection?.uid === uid && shallowEqual(lastSelection.value, selection)) return;
    lastSelection = { uid, value: selection };
    scheduleSnapshot(key, () => {
      // An account switch or sign-out in the meantime discards the previous account's write.
      if (getUid() !== uid) return;
      void writeOfflineValue(`session:${uid}:${key}`, select(store.getState()));
    });
  });
}

export async function restoreOfflineStores(uid: string): Promise<boolean> {
  const snapshots = await readOfflineValues(`session:${uid}:`);
  if (!snapshots.length) return false;
  persistenceSuspended += 1;
  try {
    for (const entry of snapshots) {
      const key = entry.key.slice(`session:${uid}:`.length);
      registrations.get(key)?.(entry.value as Record<string, unknown>);
    }
  } finally {
    persistenceSuspended -= 1;
  }
  return true;
}

export function withOfflinePersistenceSuspended<T>(operation: () => T): T {
  persistenceSuspended += 1;
  try {
    return operation();
  } finally {
    persistenceSuspended -= 1;
  }
}

export async function waitForOfflinePersistence(): Promise<void> {
  flushOfflineSnapshots();
  await Promise.all([...pendingWrites]);
}
