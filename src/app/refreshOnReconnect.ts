import type { User } from 'firebase/auth';
import { hasPendingWrites, flushWrites } from '@/shared/model/sync';
import {
  completeRecoveryRefresh,
  reportNetworkUnavailable,
  useNetworkStore,
} from '@/shared/model/network';
import { withTimeout } from '@/shared/model/session';
import { loadSessionModule } from './sessionModule';

export async function refreshAfterNetworkRecovery(
  user: User | null,
  sessionAlreadyRefreshed: boolean,
): Promise<boolean> {
  if (!useNetworkStore.getState().online) return false;

  const hadPendingWrites = Boolean(user && hasPendingWrites());
  try {
    if (user && (!sessionAlreadyRefreshed || hadPendingWrites)) {
      await withTimeout(flushWrites());
      if (hasPendingWrites() || !useNetworkStore.getState().online) return false;
      const { loadSession } = await loadSessionModule();
      await loadSession(user, true, true);
      if (!useNetworkStore.getState().online) return false;
    }
  } catch (error) {
    reportNetworkUnavailable(error);
    return false;
  }

  completeRecoveryRefresh();
  return true;
}
