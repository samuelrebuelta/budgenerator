import { createStore } from 'zustand/vanilla';
import { t } from '@bg/domain/i18n';
import { flushWrites } from '../sync.js';
import { withTimeout } from '../session.js';

/** Spanish message (`t('login.*')`) of a Firebase Auth error, shared by web and mobile forms. */
export function mapAuthError(e: unknown): string {
  const code = (e as { code?: string }).code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return t('login.errorInvalidCredentials');
    case 'auth/email-already-in-use':
      return t('login.errorEmailInUse');
    case 'auth/too-many-requests':
      return t('login.errorTooManyRequests');
    case 'auth/invalid-email':
      return t('login.errorInvalidEmail');
    case 'auth/weak-password':
      return t('login.errorWeakPassword');
    default:
      return t('login.errorGeneric');
  }
}

/** Part of the auth repository (`@bg/firebase-api/auth`) the store uses. */
export interface AuthStoreRepository<TUser> {
  signInWithEmail(email: string, password: string): Promise<unknown>;
  signUpWithEmail(email: string, password: string): Promise<{ user: { uid: string } }>;
  signOut(): Promise<void>;
  onAuthChange(callback: (user: TUser | null) => void): () => void;
  readAdminClaim(user: TUser): Promise<boolean>;
  refreshEmailVerification(): Promise<boolean>;
}

export interface AuthState<TUser> {
  user: TUser | null;
  /** From the `admin` custom claim; never from Firestore. */
  isAdmin: boolean;
  emailVerified: boolean;
  loading: boolean;
  error: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshVerification: () => Promise<boolean>;
}

/** Auth state over the platform's auth repository; generic over the SDK `User`. */
export function createAuthStore<TUser extends { emailVerified: boolean }>({
  repository,
}: {
  repository: AuthStoreRepository<TUser>;
}) {
  return createStore<AuthState<TUser>>()((set) => ({
    user: null,
    isAdmin: false,
    emailVerified: false,
    loading: true,
    error: null,

    init: () => {
      let revision = 0;
      const unsubscribe = repository.onAuthChange((user) => {
        const current = ++revision;
        if (!user) {
          set({ user: null, isAdmin: false, emailVerified: false, loading: false });
          return;
        }
        void repository.readAdminClaim(user).then((isAdmin) => {
          if (current === revision)
            set({ user, isAdmin, emailVerified: user.emailVerified, loading: false });
        });
      });
      return unsubscribe;
    },

    refreshVerification: async () => {
      const verified = await repository.refreshEmailVerification();
      set({ emailVerified: verified });
      return verified;
    },

    signIn: async (email, password) => {
      set({ error: null, loading: true });
      try {
        await repository.signInWithEmail(email, password);
      } catch (e) {
        set({ error: mapAuthError(e), loading: false });
      }
    },

    signUp: async (email, password) => {
      set({ error: null, loading: true });
      try {
        const credential = await repository.signUpWithEmail(email, password);
        set({ loading: false });
        return credential.user.uid;
      } catch (e) {
        set({ error: mapAuthError(e), loading: false });
        return null;
      }
    },

    signOut: async () => {
      await withTimeout(flushWrites());
      await repository.signOut();
    },

    clearError: () => set({ error: null }),
  }));
}
