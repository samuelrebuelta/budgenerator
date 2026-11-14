import type { UserData, UserPlan } from '@bg/domain/types';
import {
  runGuarded,
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';

export interface UserRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

/** Account root `users/{uid}` and the admin operations over it (BG-014 D2). */
export function createUserRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
}: UserRepositoryOptions) {
  const { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } = sdk;

  function userDataDoc(uid: string) {
    return doc(database, 'users', uid);
  }

  async function fetchUserData(uid: string): Promise<UserData | null> {
    const snap = await getDoc(userDataDoc(uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.accountData) return data as UserData;
    }

    // Privileged legacy accounts must be migrated by trusted administrative tooling.
    // Never copy editable legacy accountData into a newly privileged root document.

    return null;
  }

  /**
   * Creates or merges the account root. `legalAcceptanceVersion` is only sent when
   * the account is created from the registration form; Rules require the server
   * time as acceptance date.
   */
  async function saveUserData(uid: string, data: UserData, legalAcceptanceVersion?: string) {
    await setDoc(
      userDataDoc(uid),
      legalAcceptanceVersion
        ? {
            ...data,
            legalAcceptance: { version: legalAcceptanceVersion, acceptedAt: serverTimestamp() },
          }
        : data,
      { merge: true },
    );
  }

  async function updateUserData(uid: string, data: Partial<UserData>) {
    await runGuarded(guardMutation, () => updateDoc(userDataDoc(uid), data));
  }

  async function fetchAllUsers(): Promise<UserData[]> {
    const snap = await getDocs(collection(database, 'users'));
    return snap.docs.filter((d) => d.data().accountData).map((d) => d.data() as UserData);
  }

  async function adminUpdateUserPlan(uid: string, plan: UserPlan, premiumExpiresAt?: string) {
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
    await runGuarded(guardMutation, () => updateDoc(doc(database, 'users', uid), update));
  }

  async function adminUpdatePremiumExpiry(uid: string, premiumExpiresAt: string) {
    await runGuarded(guardMutation, () =>
      updateDoc(doc(database, 'users', uid), {
        'accountData.premiumExpiresAt': premiumExpiresAt,
        'accountData.premiumExpiresAtMillis': Date.parse(premiumExpiresAt),
      }),
    );
  }

  return {
    fetchUserData,
    saveUserData,
    updateUserData,
    fetchAllUsers,
    adminUpdateUserPlan,
    adminUpdatePremiumExpiry,
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
