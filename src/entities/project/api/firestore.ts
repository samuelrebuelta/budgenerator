import type { Firestore } from 'firebase/firestore';
import { createProjectRepository } from '@bg/firebase-api/project';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared project repository (`@bg/firebase-api`, BG-014 D2). */
export function createProjectFirestoreApi(database: Firestore) {
  return createProjectRepository({
    sdk: webFirestoreSdk,
    database,
    guardMutation: guardNetworkMutation,
  });
}

export type ProjectFirestoreApi = ReturnType<typeof createProjectFirestoreApi>;
