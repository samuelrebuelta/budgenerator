import { createStore } from 'zustand/vanilla';
import type { UserData, UserPlan } from '@bg/domain/types';
import { FREE_BUDGET_LIMIT, getBudgetSlotsUsed } from '@bg/domain/lib/utils';
import type { UserRepository } from '@bg/firebase-api/user';
import { isSessionCurrent, sessionRevision, sessionUid } from '../session.js';
import { registerOfflineStore } from '../offlineStateCache.js';

export interface UserState {
  userData: UserData | null;
  loaded: boolean;
  loadUserData: (uid: string, email: string) => Promise<void>;
  canCreateBudget: () => boolean;
  onBudgetCreated: (uid: string) => Promise<void>;
  // Admin
  allUsers: UserData[];
  allUsersLoaded: boolean;
  loadAllUsers: (force?: boolean) => Promise<void>;
  setUserPlan: (uid: string, plan: UserPlan, premiumExpiresAt?: string) => Promise<void>;
  setPremiumExpiry: (uid: string, premiumExpiresAt: string) => Promise<void>;
}

export type UserStoreRepository = Pick<
  UserRepository,
  | 'fetchUserData'
  | 'saveUserData'
  | 'fetchAllUsers'
  | 'adminUpdateUserPlan'
  | 'adminUpdatePremiumExpiry'
>;

export interface UserStoreOptions {
  repository: UserStoreRepository;
  /** Terms version accepted in the registration form, consumed when `users/{uid}` is created. */
  takeLegalAcceptance: () => string | null;
}

/** Account root (`users/{uid}`), quota and the admin user list. */
export function createUserStore({ repository, takeLegalAcceptance }: UserStoreOptions) {
  const store = createStore<UserState>()((set, get) => ({
    userData: null,
    loaded: false,
    allUsers: [],
    allUsersLoaded: false,

    loadUserData: async (uid, email) => {
      const revision = sessionRevision();
      let data = await repository.fetchUserData(uid);
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
        await repository.saveUserData(uid, data, takeLegalAcceptance() ?? undefined);
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

    loadAllUsers: async (force = false) => {
      if (get().allUsersLoaded && !force) return;
      const uid = sessionUid();
      const revision = sessionRevision();
      if (!uid) return;
      const users = await repository.fetchAllUsers();
      if (isSessionCurrent(uid, revision)) set({ allUsers: users, allUsersLoaded: true });
    },

    setUserPlan: async (uid, plan, premiumExpiresAt?) => {
      const revision = sessionRevision();
      const actor = sessionUid();
      await repository.adminUpdateUserPlan(uid, plan, premiumExpiresAt);
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
      await repository.adminUpdatePremiumExpiry(uid, premiumExpiresAt);
      if (!actor || !isSessionCurrent(actor, revision)) return;
      set((s) => ({
        allUsers: s.allUsers.map((u) =>
          u.uid === uid ? { ...u, accountData: { ...u.accountData, premiumExpiresAt } } : u,
        ),
      }));
    },
  }));

  registerOfflineStore('user', store, sessionUid, (state) => ({
    userData: state.userData,
    loaded: state.loaded,
    allUsers: state.allUsers,
    allUsersLoaded: state.allUsersLoaded,
  }));

  return {
    store,
    reset() {
      store.setState({ userData: null, loaded: false, allUsers: [], allUsersLoaded: false });
    },
  };
}
