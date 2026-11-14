import type { CompanyProfile } from '@bg/domain/types';
import {
  runGuarded,
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';

export interface ProfileRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

/** Company profile of `users/{uid}/profile/data`, migrating the legacy location on read. */
export function createProfileRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
}: ProfileRepositoryOptions) {
  const { deleteDoc, doc, getDoc, setDoc } = sdk;

  function profileDoc(uid: string) {
    return doc(database, 'users', uid, 'profile', 'data');
  }

  function legacyProfileDoc(uid: string) {
    return doc(database, 'users', uid, 'settings', 'profile');
  }

  async function fetchProfile(uid: string): Promise<CompanyProfile | null> {
    const snap = await getDoc(profileDoc(uid));
    if (snap.exists()) return snap.data() as CompanyProfile;

    const legacySnap = await getDoc(legacyProfileDoc(uid));
    if (legacySnap.exists()) {
      const data = legacySnap.data() as CompanyProfile;
      await setDoc(profileDoc(uid), data);
      await deleteDoc(legacyProfileDoc(uid));
      return data;
    }

    return null;
  }

  async function saveProfile(uid: string, profile: CompanyProfile) {
    await runGuarded(guardMutation, () => setDoc(profileDoc(uid), profile));
  }

  return { fetchProfile, saveProfile };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
