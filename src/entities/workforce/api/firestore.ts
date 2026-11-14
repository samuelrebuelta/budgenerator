import type { Firestore } from 'firebase/firestore';
import { createWorkforceRepository } from '@bg/firebase-api/workforce';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared workforce repository (`@bg/firebase-api`, BG-014 D2). */
export function createWorkforceFirestoreApi(database: Firestore) {
  return createWorkforceRepository({
    sdk: webFirestoreSdk,
    database,
    guardMutation: guardNetworkMutation,
  });
}
