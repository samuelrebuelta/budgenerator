import { create } from 'zustand';
import type { UserData, UserPlan } from '@/shared/types';
import {
  fetchUserData,
  saveUserData,
  fetchAllUsers,
  adminUpdateUserPlan,
  adminUpdatePremiumExpiry,
} from '@/entities/user/api/firestore';
import { isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import { getBudgetSlotsUsed } from '@/shared/lib/utils';

export { FREE_BUDGET_LIMIT } from '@/shared/lib/utils';
import { FREE_BUDGET_LIMIT } from '@/shared/lib/utils';

interface UserState {
  userData: UserData | null;
  loaded: boolean;
  loadUserData: (uid: string, email: string) => Promise<void>;
  canCreateBudget: () => boolean;
  onBudgetCreated: (uid: string) => Promise<void>;
  // Admin
  allUsers: UserData[];
  allUsersLoaded: boolean;
  loadAllUsers: () => Promise<void>;
  setUserPlan: (uid: string, plan: UserPlan, premiumExpiresAt?: string) => Promise<void>;
  setPremiumExpiry: (uid: string, premiumExpiresAt: string) => Promise<void>;
}

export function setUserAuthGetter(_fn: () => string) {
  void _fn;
}
export function getUserUid(): string {
  return sessionUid() ?? '';
}
export function resetUserStore() {
  useUserStore.setState({ userData: null, loaded: false, allUsers: [], allUsersLoaded: false });
}

export const useUserStore = create<UserState>((set, get) => ({
  userData: null,
  loaded: false,
  allUsers: [],
  allUsersLoaded: false,

  loadUserData: async (uid, email) => {
    const revision = sessionRevision();
    let data = await fetchUserData(uid);
    if (!data) {
      const isAdmin = false;
      data = {
        uid,
        email,
        accountData: { isAdmin, plan: 'free' },
        totalBudgetsCreated: 0,
        budgetSlotsReleased: 0,
        createdAt: new Date().toISOString(),
      };
      await saveUserData(uid, data);
    }
    if (isSessionCurrent(uid, revision)) set({ userData: data, loaded: true });
  },

  canCreateBudget: () => {
    const { userData } = get();
    if (!userData) return false;
    if (userData.accountData.plan === 'premium') {
      const { premiumExpiresAt } = userData.accountData;
      if (!premiumExpiresAt || new Date(premiumExpiresAt) > new Date()) return true;
    }
    return getBudgetSlotsUsed(userData.totalBudgetsCreated) < FREE_BUDGET_LIMIT;
  },

  onBudgetCreated: async (uid) => {
    await get().loadUserData(uid, get().userData?.email ?? '');
  },

  loadAllUsers: async () => {
    const uid = sessionUid();
    const revision = sessionRevision();
    if (!uid) return;
    const users = await fetchAllUsers();
    if (isSessionCurrent(uid, revision)) set({ allUsers: users, allUsersLoaded: true });
  },

  setUserPlan: async (uid, plan, premiumExpiresAt?) => {
    const revision = sessionRevision();
    const actor = sessionUid();
    await adminUpdateUserPlan(uid, plan, premiumExpiresAt);
    if (!actor || !isSessionCurrent(actor, revision)) return;
    const expiresAt =
      plan === 'premium'
        ? (premiumExpiresAt ??
          (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString();
          })())
        : undefined;
    set((s) => ({
      allUsers: s.allUsers.map((u) =>
        u.uid === uid
          ? { ...u, accountData: { ...u.accountData, plan, premiumExpiresAt: expiresAt } }
          : u,
      ),
    }));
  },

  setPremiumExpiry: async (uid, premiumExpiresAt) => {
    const revision = sessionRevision();
    const actor = sessionUid();
    await adminUpdatePremiumExpiry(uid, premiumExpiresAt);
    if (!actor || !isSessionCurrent(actor, revision)) return;
    set((s) => ({
      allUsers: s.allUsers.map((u) =>
        u.uid === uid ? { ...u, accountData: { ...u.accountData, premiumExpiresAt } } : u,
      ),
    }));
  },
}));
