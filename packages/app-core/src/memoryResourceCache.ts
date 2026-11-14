import {
  isBrowserDisconnected,
  markNetworkAvailable,
  reportNetworkUnavailable,
} from './network.js';
import {
  deleteOfflineValue,
  readOfflineValue,
  readOfflineValues,
  writeOfflineValue,
} from './offlineStateCache.js';

const resources = new Map<string, unknown>();
let resourceGeneration = 0;

export class OfflineReadUnavailableError extends Error {
  readonly code = 'offline/read-unavailable';

  constructor(cause?: unknown) {
    super(
      'Esta pantalla aún no tiene datos cargados en esta sesión. Conéctate a internet para abrirla.',
      {
        cause,
      },
    );
    this.name = 'OfflineReadUnavailableError';
  }
}

export function getMemoryResource<T>(key: string): T | undefined {
  return resources.get(key) as T | undefined;
}

export function setMemoryResource<T>(key: string, value: T) {
  resources.set(key, value);
  return writeOfflineValue(`resource:${key}`, value);
}

export function deleteMemoryResource(key: string) {
  resources.delete(key);
  return deleteOfflineValue(`resource:${key}`);
}

export function clearMemoryResources() {
  resourceGeneration += 1;
  resources.clear();
}

export async function restorePersistedMemoryResources(uid: string): Promise<number> {
  const generation = resourceGeneration;
  const prefix = `resource:private:${uid}:`;
  const entries = await readOfflineValues(prefix);
  if (generation !== resourceGeneration) return 0;
  for (const entry of entries) resources.set(entry.key.slice('resource:'.length), entry.value);
  return entries.length;
}

export async function loadMemoryResource<T>(key: string, load: () => Promise<T>): Promise<T> {
  let cached = getMemoryResource<T>(key);
  const generation = resourceGeneration;
  if (isBrowserDisconnected()) {
    if (cached === undefined) {
      try {
        const persisted = (await readOfflineValue(`resource:${key}`)) as T | undefined;
        if (generation === resourceGeneration && persisted !== undefined) {
          resources.set(key, persisted);
          cached = persisted;
        }
      } catch {
        // A missing or unavailable local cache falls through to the offline state below.
      }
    }
    if (cached !== undefined) return cached;
    throw new OfflineReadUnavailableError();
  }

  try {
    const value = await load();
    if (generation === resourceGeneration) await setMemoryResource(key, value);
    markNetworkAvailable();
    return value;
  } catch (error) {
    if (!reportNetworkUnavailable(error)) throw error;
    if (cached === undefined) {
      try {
        const persisted = (await readOfflineValue(`resource:${key}`)) as T | undefined;
        if (generation === resourceGeneration && persisted !== undefined) {
          resources.set(key, persisted);
          cached = persisted;
        }
      } catch {
        // A missing or unavailable local cache falls through to the offline state below.
      }
    }
    if (cached !== undefined) return cached;
    throw new OfflineReadUnavailableError(error);
  }
}
