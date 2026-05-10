import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { UserData, UserPlan } from '@/shared/types';

function userDataDoc(uid: string) {
  return doc(db, 'users', uid);
}

function legacyUserDataDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'userData');
}

export async function fetchUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(userDataDoc(uid));
  if (snap.exists()) {
    const data = snap.data();
    if (data.accountData) return data as UserData;
  }

  const legacySnap = await getDoc(legacyUserDataDoc(uid));
  if (legacySnap.exists()) {
    const data = legacySnap.data() as UserData;
    if (data.accountData) {
      await setDoc(userDataDoc(uid), data, { merge: true });
      await deleteDoc(legacyUserDataDoc(uid));
      return data;
    }
  }

  return null;
}

export async function saveUserData(uid: string, data: UserData) {
  await setDoc(userDataDoc(uid), data, { merge: true });
}

export async function updateUserData(uid: string, data: Partial<UserData>) {
  await updateDoc(userDataDoc(uid), data);
}

export async function incrementBudgetCount(uid: string) {
  const data = await fetchUserData(uid);
  if (data) {
    await updateDoc(userDataDoc(uid), { totalBudgetsCreated: data.totalBudgetsCreated + 1 });
  }
}

export async function fetchAllUsers(): Promise<UserData[]> {
  const usersCol = collection(db, 'users');
  const usersSnap = await getDocs(usersCol);
  const results: UserData[] = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();

    if (data.accountData) {
      results.push(data as UserData);
      continue;
    }

    const legacyRef = doc(db, 'users', userDoc.id, 'settings', 'userData');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const legacyData = legacySnap.data() as UserData;
      if (legacyData.accountData) {
        await setDoc(userDataDoc(userDoc.id), legacyData, { merge: true });
        await deleteDoc(legacyRef);
        results.push(legacyData);
      }
    }
  }

  return results;
}

export async function adminUpdateUserPlan(uid: string, plan: UserPlan, premiumExpiresAt?: string) {
  const update: Record<string, unknown> = { 'accountData.plan': plan };
  if (plan === 'premium') {
    update['accountData.premiumExpiresAt'] = premiumExpiresAt ?? (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString();
    })();
  } else {
    update['accountData.premiumExpiresAt'] = null;
  }
  await updateDoc(doc(db, 'users', uid), update);
}

export async function adminUpdatePremiumExpiry(uid: string, premiumExpiresAt: string) {
  await updateDoc(doc(db, 'users', uid), { 'accountData.premiumExpiresAt': premiumExpiresAt });
}
