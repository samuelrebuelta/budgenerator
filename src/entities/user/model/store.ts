import { create } from 'zustand';
import type { UserData, UserPlan } from '@/shared/types';
import {
  fetchUserData,
  saveUserData,
  incrementBudgetCount,
  fetchAllUsers,
  adminUpdateUserPlan,
} from '@/shared/firebase';

export const FREE_BUDGET_LIMIT = 3;
const ADMIN_EMAIL = 'admin@admin.com';

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
  setUserPlan: (uid: string, plan: UserPlan) => Promise<void>;
}

let _getUid: (() => string) | null = null;

export function setUserAuthGetter(fn: () => string) {
  _getUid = fn;
}

export function getUserUid(): string {
  return _getUid?.() ?? '';
}

export const useUserStore = create<UserState>((set, get) => ({
  userData: null,
  loaded: false,
  allUsers: [],
  allUsersLoaded: false,

  loadUserData: async (uid, email) => {
    let data = await fetchUserData(uid);
    if (!data) {
      const isAdmin = email === ADMIN_EMAIL;
      data = {
        uid,
        email,
        accountData: { isAdmin, plan: isAdmin ? 'premium' : 'free' },
        totalBudgetsCreated: 0,
        createdAt: new Date().toISOString(),
      };
      await saveUserData(uid, data);
    }
    set({ userData: data, loaded: true });
  },

  canCreateBudget: () => {
    const { userData } = get();
    if (!userData) return false;
    if (userData.accountData.plan === 'premium') return true;
    return userData.totalBudgetsCreated < FREE_BUDGET_LIMIT;
  },

  onBudgetCreated: async (uid) => {
    await incrementBudgetCount(uid);
    const { userData } = get();
    if (userData) {
      set({ userData: { ...userData, totalBudgetsCreated: userData.totalBudgetsCreated + 1 } });
    }
  },

  loadAllUsers: async () => {
    try {
      const users = await fetchAllUsers();
      set({ allUsers: users, allUsersLoaded: true });
    } catch (e) {
      console.error('Failed to load users:', e);
      set({ allUsers: [], allUsersLoaded: true });
    }
  },

  setUserPlan: async (uid, plan) => {
    await adminUpdateUserPlan(uid, plan);
    set((s) => ({
      allUsers: s.allUsers.map((u) =>
        u.uid === uid ? { ...u, accountData: { ...u.accountData, plan } } : u,
      ),
    }));
  },
}));
