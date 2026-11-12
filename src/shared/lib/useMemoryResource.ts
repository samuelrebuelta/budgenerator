import { useEffect, useEffectEvent, useState } from 'react';
import { useNetworkStore } from '@/shared/model/network';
import {
  getMemoryResource,
  loadMemoryResource,
  OfflineReadUnavailableError,
  setMemoryResource,
} from './memoryResourceCache';
import { toUserMessage } from './errors';

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

export interface MemoryResource<T> {
  /** Last loaded value, or the cached one while revalidating. */
  data: T | undefined;
  status: ResourceStatus;
  /** User-facing message when `status` is `error`. */
  error: string;
  /** Loads again, e.g. from a «Reintentar» button. */
  retry: () => void;
  /** Replaces the value locally and in the memory/offline cache after a mutation. */
  setData: (value: T) => void;
}

interface ResourceState<T> {
  key: string;
  data?: T;
  error?: string;
  offline?: boolean;
}

export interface MemoryResourceOptions<T> {
  /** Message shown when loading fails for an unknown reason. */
  errorMessage?: string;
  /** Called after each successful load (e.g. to cache child resources). */
  onLoaded?: (value: T) => void;
}

/**
 * Route data with the memory/offline cache (shared/lib/memoryResourceCache): shows the cached
 * value immediately, revalidates on mount, on `retry()` and when the network recovers
 * (`dataRefreshVersion`), and discards responses for an outdated key. `key: null` disables it.
 */
export function useMemoryResource<T>(
  key: string | null,
  load: () => Promise<T>,
  { errorMessage, onLoaded }: MemoryResourceOptions<T> = {},
): MemoryResource<T> {
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const runLoad = useEffectEvent(() => load());
  const loaded = useEffectEvent((value: T) => onLoaded?.(value));
  const failure = useEffectEvent((error: unknown) => toUserMessage(error, errorMessage));

  useEffect(() => {
    if (!key) return;
    let active = true;
    loadMemoryResource(key, runLoad)
      .then((data) => {
        if (!active) return;
        loaded(data);
        setState({ key, data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof OfflineReadUnavailableError) setState({ key, offline: true });
        else setState({ key, error: failure(error) });
      });
    return () => {
      active = false;
    };
  }, [key, dataRefreshVersion, attempt]);

  const current = key && state?.key === key ? state : null;
  const cached = key ? getMemoryResource<T>(key) : undefined;
  const data = current?.data ?? cached;
  let status: ResourceStatus;
  if (!key) status = 'idle';
  else if (current?.error && data === undefined) status = 'error';
  else if (data !== undefined) status = 'ready';
  else if (current?.offline || !online) status = 'offline';
  else status = 'loading';

  return {
    data,
    status,
    error: current?.error ?? '',
    retry: () => setAttempt((value) => value + 1),
    setData: (value: T) => {
      if (!key) return;
      void setMemoryResource(key, value);
      setState({ key, data: value });
    },
  };
}
