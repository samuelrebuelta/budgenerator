import { createProfileRepository } from '@bg/firebase-api/profile';
import { db } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared profile repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createProfileRepository({
  sdk: webFirestoreSdk,
  database: db,
  guardMutation: guardNetworkMutation,
});

export const { fetchProfile, saveProfile } = repository;
