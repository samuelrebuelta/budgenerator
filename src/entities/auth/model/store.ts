import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as fbSignOut,
  onAuthChange,
} from '@/shared/firebase';

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
      set({ error: (e as Error).message, loading: false });
    }
  },

  signUp: async (email, password) => {
    set({ error: null, loading: true });
    try {
      await signUpWithEmail(email, password);
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  signOut: async () => {
    await fbSignOut();
  },

  clearError: () => set({ error: null }),
}));
