import { createUserRepository } from '@bg/firebase-api/user';
import { db } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared user repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createUserRepository({
  sdk: webFirestoreSdk,
  database: db,
  guardMutation: guardNetworkMutation,
});

export const {
  fetchUserData,
  saveUserData,
  updateUserData,
  fetchAllUsers,
  adminUpdateUserPlan,
  adminUpdatePremiumExpiry,
} = repository;
