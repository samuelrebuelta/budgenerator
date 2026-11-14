import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from '@react-native-firebase/auth';
import type { AuthSdk } from '@bg/firebase-api/authPort';

export type NativeUser = User;

/**
 * React Native Firebase Auth (modular API) injected into the shared auth repository of
 * `@bg/firebase-api` (BG-014 D2). Same names as the web binding (`src/shared/firebase/authSdk.ts`).
 */
export const nativeAuthSdk: AuthSdk<NativeUser> = {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  // RNFB rejects `signOut` without a user (auth/no-current-user), unlike the web SDK.
  signOut: async (auth) => {
    if (auth.currentUser) await signOut(auth as Parameters<typeof signOut>[0]);
  },
  updatePassword,
  emailCredential: (email, password) => EmailAuthProvider.credential(email, password),
};
