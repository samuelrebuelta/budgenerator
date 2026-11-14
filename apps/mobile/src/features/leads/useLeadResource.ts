import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getMemoryResource,
  loadMemoryResource,
  OfflineReadUnavailableError,
} from '@bg/app-core/memoryResourceCache';
import { toUserMessage } from '@bg/domain/lib/errors';
import { useNetworkStore } from '../../state/stores';

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

interface ResourceState<T> {
  key: string;
  data?: T;
  error?: string;
  offline?: boolean;
}

/**
 * Mobile counterpart of the web's `useMemoryResource` over the shared memory/offline cache of
 * `@bg/app-core` (MMKV of the account): shows the cached value at once and revalidates on mount,
 * when the screen regains focus (e.g. back from saving a budget from the lead), on `retry()` and
 * when the network recovers (`dataRefreshVersion`). The cache wins over the local state, so a
 * mutation that rewrites it (`setMemoryResource`) shows up on the next render.
 */
export function useLeadResource<T>(
  key: string | null,
  load: () => Promise<T>,
  { errorMessage, onLoaded }: { errorMessage: string; onLoaded?: (value: T) => void },
) {
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const runLoad = useEffectEvent(() => load());
  const loaded = useEffectEvent((value: T) => onLoaded?.(value));
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (focused.current) setAttempt((value) => value + 1);
      focused.current = true;
    }, []),
  );

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
        else setState({ key, error: toUserMessage(error, errorMessage) });
      });
    return () => {
      active = false;
    };
  }, [key, dataRefreshVersion, attempt, errorMessage]);

  const current = key && state?.key === key ? state : null;
  const cached = key ? getMemoryResource<T>(key) : undefined;
  const data = cached !== undefined ? cached : current?.data;
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
  };
}
