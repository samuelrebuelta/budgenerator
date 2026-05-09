import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as fbSignOut,
  onAuthChange,
} from '@/shared/firebase';

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
  loading: boolean;
  error: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  error: null,

  init: () => {
    const unsubscribe = onAuthChange((user) => {
      set({ user, loading: false });
    });
    return unsubscribe;
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
      await signUpWithEmail(email, password);
    } catch (e) {
      set({ error: mapAuthError(e), loading: false });
    }
  },

  signOut: async () => {
    await fbSignOut();
  },

  clearError: () => set({ error: null }),
}));
