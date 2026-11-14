/**
 * In-memory stand-ins for the RNFB repositories (`src/platform/repositories.ts`) so the screens
 * run the real `@bg/app-core` stores and session coordinator under Jest. Auth is driven by
 * `setMockUser`/`emitAuthUser`; the shared repositories are tested against Firestore in
 * `packages/firebase-api/tests` and on the simulator.
 */
export interface FakeUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  reload: () => Promise<void>;
  getIdToken: () => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
}

export function fakeUser(uid: string, overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    uid,
    email: `${uid}@example.com`,
    emailVerified: false,
    reload: async () => undefined,
    getIdToken: async () => 'token',
    getIdTokenResult: async () => ({ claims: {} }),
    ...overrides,
  };
}

const listeners = new Set<(user: FakeUser | null) => void>();
export const authState: { user: FakeUser | null } = { user: null };

/** Changes the signed-in user and notifies the auth store, like `onAuthStateChanged`. */
export function emitAuthUser(user: FakeUser | null) {
  authState.user = user;
  for (const listener of listeners) listener(user);
}

export function createFakeRepositories() {
  const auth = {
    signInWithEmail: jest.fn(async (email: string) => {
      emitAuthUser(fakeUser(email.split('@')[0] ?? 'user', { email }));
    }),
    signUpWithEmail: jest.fn(async (email: string) => {
      const user = fakeUser(`new-${email.split('@')[0] ?? 'user'}`, { email });
      emitAuthUser(user);
      return { user };
    }),
    signOut: jest.fn(async () => emitAuthUser(null)),
    onAuthChange: (callback: (user: FakeUser | null) => void) => {
      listeners.add(callback);
      callback(authState.user);
      return () => {
        listeners.delete(callback);
      };
    },
    readAdminClaim: jest.fn(async () => false),
    refreshEmailVerification: jest.fn(async () => authState.user?.emailVerified ?? false),
    resendVerificationEmail: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
  };
  const now = '2026-11-14T00:00:00.000Z';
  return {
    auth,
    user: {
      fetchUserData: jest.fn(async () => null),
      saveUserData: jest.fn(async () => undefined),
      fetchAllUsers: jest.fn(async () => []),
      adminUpdateUserPlan: jest.fn(async () => undefined),
      adminUpdatePremiumExpiry: jest.fn(async () => undefined),
    },
    budget: {
      fetchBudgets: jest.fn(async () => []),
      fetchBudget: jest.fn(async () => null),
      saveBudget: jest.fn(async () => 1),
      createBudget: jest.fn(),
      deleteBudgetDoc: jest.fn(async () => undefined),
      shareBudget: jest.fn(async () => 'shared-token'),
      revokeSharedBudget: jest.fn(async () => undefined),
    },
    budgetAcceptance: { acceptBudget: jest.fn(), withdrawBudgetAcceptance: jest.fn() },
    catalog: {
      ensureCatalog: jest.fn(async (_uid: string, document: unknown) => ({
        id: 'main',
        revision: 1,
        createdAt: now,
        updatedAt: now,
        document,
      })),
      fetchCatalog: jest.fn(async () => null),
      saveCatalog: jest.fn(async () => 2),
    },
    profile: {
      fetchProfile: jest.fn(async () => null),
      saveProfile: jest.fn(async () => undefined),
    },
    project: { fetchProjects: jest.fn(async () => []), fetchProject: jest.fn(async () => null) },
    template: { fetchTemplates: jest.fn(async () => []) },
    workforce: { fetchMembers: jest.fn(async () => []), fetchCrews: jest.fn(async () => []) },
    notifications: {},
  };
}
