import { syncStore } from '@bg/app-core/sync';
import { bindStore } from '@/shared/lib/bindStore';

export {
  syncStatus,
  registerFlusher,
  flushWrites,
  scheduleFlushWrites,
  hasPendingWrites,
  type SyncState,
} from '@bg/app-core/sync';

export const useSyncStore = bindStore(syncStore);
