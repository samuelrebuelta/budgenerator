import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { CompanyProfile } from '@/shared/types';

function profileDoc(uid: string) {
  return doc(db, 'users', uid, 'profile', 'data');
}

function legacyProfileDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'profile');
}

export async function fetchProfile(uid: string): Promise<CompanyProfile | null> {
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

export async function saveProfile(uid: string, profile: CompanyProfile) {
  await setDoc(profileDoc(uid), profile);
}
