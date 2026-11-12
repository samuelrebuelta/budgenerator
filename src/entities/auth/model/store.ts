import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as fbSignOut,
  onAuthChange,
  readAdminClaim,
  refreshEmailVerification,
} from '@/entities/auth/api/firebase';

import { flushWrites } from '@/shared/model/sync';
import { withTimeout } from '@/shared/model/session';
import { t } from '@/shared/i18n';

function mapAuthError(e: unknown): string {
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

interface AuthState {
  user: User | null;
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

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAdmin: false,
  emailVerified: false,
  loading: true,
  error: null,

  init: () => {
    let revision = 0;
    const unsubscribe = onAuthChange((user) => {
      const current = ++revision;
      if (!user) {
        set({ user: null, isAdmin: false, emailVerified: false, loading: false });
        return;
      }
      void readAdminClaim(user).then((isAdmin) => {
        if (current === revision)
          set({ user, isAdmin, emailVerified: user.emailVerified, loading: false });
      });
    });
    return unsubscribe;
  },

  refreshVerification: async () => {
    const verified = await refreshEmailVerification();
    set({ emailVerified: verified });
    return verified;
  },

  signIn: async (email, password) => {
    set({ error: null, loading: true });
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      set({ error: mapAuthError(e), loading: false });
    }
  },

  signUp: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const credential = await signUpWithEmail(email, password);
      set({ loading: false });
      return credential.user.uid;
    } catch (e) {
      set({ error: mapAuthError(e), loading: false });
      return null;
    }
  },

  signOut: async () => {
    await withTimeout(flushWrites());
    await fbSignOut();
  },

  clearError: () => set({ error: null }),
}));
