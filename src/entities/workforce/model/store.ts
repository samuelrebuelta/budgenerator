import '@/shared/platform';
import { createWorkforceStore } from '@bg/app-core/stores/workforce';
import { db } from '@/shared/firebase/config';
import { bindStore } from '@/shared/lib/bindStore';
import { createWorkforceFirestoreApi } from '../api/firestore';

export type { WorkforceState } from '@bg/app-core/stores/workforce';

/** Web binding of the shared workforce store (`@bg/app-core`). */
const workforce = createWorkforceStore({ repository: createWorkforceFirestoreApi(db) });

export const useWorkforceStore = bindStore(workforce.store);
export const resetWorkforceStore = workforce.reset;
