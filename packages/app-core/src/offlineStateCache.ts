import type { KeyValueStore, LifecyclePort, OfflineEntry } from './ports.js';

export type { OfflineEntry } from './ports.js';

interface PersistedStore<TState> {
  getState: () => TState;
  setState: (state: Partial<TState>) => void;
  subscribe: (listener: (state: TState) => void) => () => void;
}

/**
 * Offline snapshots of the entity stores and route resources (BG-012). Every value is kept in
 * memory for the current app session and written to the platform `KeyValueStore` (web:
 * IndexedDB, mobile: MMKV). Without a store, or when it fails, the in-memory copy still serves
 * the session, as the web did when IndexedDB was unavailable.
 */
let storage: KeyValueStore | null = null;
let lifecycle: LifecyclePort | null = null;
const fallbackEntries = new Map<string, OfflineEntry>();
const registrations = new Map<string, (snapshot: Record<string, unknown>) => void>();
/**
 * Restored snapshots of stores whose module was not loaded yet (route chunks load lazily). They
 * are applied when the store registers, as long as the same account is still signed in.
 */
const pendingSnapshots = new Map<string, { uid: string; value: Record<string, unknown> }>();
const pendingWrites = new Set<Promise<void>>();
let persistenceSuspended = 0;

/**
 * Installs the platform storage and lifecycle. Call it once at startup, before the stores
 * restore or write snapshots; `null` keeps only the in-memory copy (tests, unsupported runtimes).
 */
export function configureOfflineStorage(
  store: KeyValueStore | null,
  options: { lifecycle?: LifecyclePort } = {},
) {
  storage = store;
  lifecycle = options.lifecycle ?? null;
  flushListenersInstalled = false;
  if (registrations.size) installFlushListeners();
}

function trackWrite(operation: Promise<void>) {
  pendingWrites.add(operation);
  void operation.finally(() => pendingWrites.delete(operation));
  return operation;
}

export function writeOfflineValue(key: string, value: unknown): Promise<void> {
  const entry: OfflineEntry = { key, value, savedAt: Date.now() };
  fallbackEntries.set(key, entry);
  const target = storage;
  return trackWrite(
    (async () => {
      try {
        await target?.put(entry);
      } catch {
        // The in-memory copy still serves this session.
      }
    })(),
  );
}

export async function readOfflineValue(key: string): Promise<unknown | undefined> {
  if (storage) {
    try {
      const entry = await storage.get(key);
      if (entry) {
        fallbackEntries.set(key, entry);
        return entry.value;
      }
    } catch {
      // Use the current session copy when the store is unavailable.
    }
  }
  return fallbackEntries.get(key)?.value;
}

export async function readOfflineValues(prefix: string): Promise<OfflineEntry[]> {
  const entries = new Map<string, OfflineEntry>();
  if (storage) {
    try {
      const stored = await storage.getAll(prefix);
      for (const entry of stored) if (entry.key.startsWith(prefix)) entries.set(entry.key, entry);
    } catch {
      // Continue with the current session copy when the store is unavailable.
    }
  }
  for (const [key, entry] of fallbackEntries) if (key.startsWith(prefix)) entries.set(key, entry);
  return [...entries.values()];
}

export async function deleteOfflineValues(prefix: string): Promise<void> {
  const keys = new Set<string>();
  for (const key of fallbackEntries.keys()) if (key.startsWith(prefix)) keys.add(key);
  if (storage) {
    try {
      for (const key of await storage.getAllKeys(prefix)) if (key.startsWith(prefix)) keys.add(key);
    } catch {
      // The in-memory copies are still removed below.
    }
    if (keys.size) {
      try {
        await storage.delete([...keys]);
      } catch {
        // Best effort, as with IndexedDB.
      }
    }
  }
  for (const key of keys) fallbackEntries.delete(key);
}

export async function deleteOfflineValue(key: string): Promise<void> {
  fallbackEntries.delete(key);
  if (!storage) return;
  try {
    await storage.delete([key]);
  } catch {
    // Best effort, as with IndexedDB.
  }
}

export async function deleteOfflineUserData(uid: string): Promise<void> {
  for (const [key, pending] of pendingSnapshots)
    if (pending.uid === uid) pendingSnapshots.delete(key);
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

/** Flushes pending snapshots when the app goes to the background (installed on first use). */
function installFlushListeners() {
  if (flushListenersInstalled || !lifecycle) return;
  flushListenersInstalled = true;
  lifecycle.onBackground(flushOfflineSnapshots);
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
  const pending = pendingSnapshots.get(key);
  pendingSnapshots.delete(key);
  if (pending && pending.uid === getUid()) {
    persistenceSuspended += 1;
    try {
      store.setState(pending.value as Partial<TState>);
    } finally {
      persistenceSuspended -= 1;
    }
  }
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
  pendingSnapshots.clear();
  if (!snapshots.length) return false;
  persistenceSuspended += 1;
  try {
    for (const entry of snapshots) {
      const key = entry.key.slice(`session:${uid}:`.length);
      const value = entry.value as Record<string, unknown>;
      const apply = registrations.get(key);
      if (apply) apply(value);
      else pendingSnapshots.set(key, { uid, value });
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
