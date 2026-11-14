/**
 * Platform ports of `@bg/app-core` (BG-014 §2.3 B). Each platform implements them once:
 *
 * | Port               | Web (`src/shared/platform`)        | Mobile (`apps/mobile/src/platform`) |
 * | ------------------ | ---------------------------------- | ----------------------------------- |
 * | `KeyValueStore`    | IndexedDB `budgenerator-offline-state` | MMKV, one instance per UID      |
 * | `ConnectivityPort` | `navigator.onLine`                 | NetInfo                             |
 * | `DraftStorage`     | `sessionStorage`                   | MMKV of the UID                     |
 * | `ImageNormalizer`  | `<canvas>` + `encodeLogo`          | `expo-image-manipulator`            |
 * | `LifecyclePort`    | `pagehide` / `visibilitychange`    | `AppState` → background             |
 */

/** One persisted value; `key` carries the account (`session:{uid}:…`, `resource:private:{uid}:…`). */
export interface OfflineEntry {
  key: string;
  value: unknown;
  savedAt: number;
}

/**
 * Durable store of the offline snapshots (BG-012). Implementations may reject; the cache then
 * falls back to its in-memory copy, as the web did when IndexedDB was unavailable.
 */
export interface KeyValueStore {
  get(key: string): Promise<OfflineEntry | undefined>;
  /** Entries whose key starts with `prefix`. */
  getAll(prefix: string): Promise<OfflineEntry[]>;
  /** Keys that start with `prefix`. */
  getAllKeys(prefix: string): Promise<string[]>;
  put(entry: OfflineEntry): Promise<void>;
  delete(keys: string[]): Promise<void>;
}

/** Device connectivity. `undefined` means the platform cannot tell (the last state is kept). */
export interface ConnectivityPort {
  isOnline(): boolean | undefined;
  /** Optional change feed; `watchConnectivity()` forwards it to the network store. */
  subscribe?(listener: (online: boolean) => void): () => void;
}

/** Synchronous storage of unsaved drafts for the current app session (budget editor). */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Keys that start with `prefix`, to drop the drafts of a previous account. */
  keys(prefix: string): string[];
}

/** Turns a picked image into the logo data URL stored in the profile (`encodeLogo` budget). */
export type ImageNormalizer<TImage> = (image: TImage) => Promise<string>;

/** Notifies when the app goes to the background so pending snapshots are written. */
export interface LifecyclePort {
  onBackground(listener: () => void): void;
}
