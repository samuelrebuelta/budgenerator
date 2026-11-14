import type { Firestore } from 'firebase/firestore';
import { createBudgetAcceptanceRepository } from '@bg/firebase-api/budget';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared acceptance repository (`@bg/firebase-api`, BG-014 D2). */
export function createBudgetAcceptanceApi(database: Firestore) {
  return createBudgetAcceptanceRepository({
    sdk: webFirestoreSdk,
    database,
    guardMutation: guardNetworkMutation,
  });
}
