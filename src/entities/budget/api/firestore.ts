import type { DocumentReference } from 'firebase/firestore';
import { createBudgetRepository } from '@bg/firebase-api/budget';
import { db, auth } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

export type { BudgetRoot } from '@bg/firebase-api/storedDocument';
export type { SharedBudget } from '@bg/firebase-api/budget';
export { recordFromStored } from '@bg/firebase-api/budget';

/** Web binding of the shared budget repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createBudgetRepository({
  sdk: webFirestoreSdk,
  database: db,
  guardMutation: guardNetworkMutation,
  currentUid: () => auth.currentUser?.uid,
});

export const budgetRef = repository.budgetRef as (uid: string, id: string) => DocumentReference;
export const {
  fetchBudget,
  fetchBudgets,
  saveBudget,
  deleteBudgetDoc,
  createBudget,
  shareBudget,
  revokeSharedBudget,
  fetchSharedBudget,
} = repository;
