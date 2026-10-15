import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { UserData, UserPlan } from '@/shared/types';

function userDataDoc(uid: string) {
  return doc(db, 'users', uid);
}

export async function fetchUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(userDataDoc(uid));
  if (snap.exists()) {
    const data = snap.data();
    if (data.accountData) return data as UserData;
  }

  // Privileged legacy accounts must be migrated by trusted administrative tooling.
  // Never copy editable legacy accountData into a newly privileged root document.

  return null;
}

export async function saveUserData(uid: string, data: UserData) {
  await setDoc(userDataDoc(uid), data, { merge: true });
}

export async function updateUserData(uid: string, data: Partial<UserData>) {
  await updateDoc(userDataDoc(uid), data);
}

export async function fetchAllUsers(): Promise<UserData[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.filter((d) => d.data().accountData).map((d) => d.data() as UserData);
}

export async function adminUpdateUserPlan(uid: string, plan: UserPlan, premiumExpiresAt?: string) {
  const update: Record<string, unknown> = { 'accountData.plan': plan };
  if (plan === 'premium') {
    update['accountData.premiumExpiresAt'] =
      premiumExpiresAt ??
      (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString();
      })();
  } else {
    update['accountData.premiumExpiresAt'] = null;
    update['accountData.premiumExpiresAtMillis'] = null;
  }
  if (plan === 'premium')
    update['accountData.premiumExpiresAtMillis'] = Date.parse(
      update['accountData.premiumExpiresAt'] as string,
    );
  await updateDoc(doc(db, 'users', uid), update);
}

export async function adminUpdatePremiumExpiry(uid: string, premiumExpiresAt: string) {
  await updateDoc(doc(db, 'users', uid), {
    'accountData.premiumExpiresAt': premiumExpiresAt,
    'accountData.premiumExpiresAtMillis': Date.parse(premiumExpiresAt),
  });
}
