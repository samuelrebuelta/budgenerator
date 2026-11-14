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
} from 'firebase/auth';
import type { AuthSdk } from '@bg/firebase-api/authPort';

/**
 * Firebase JS SDK Auth functions injected into the shared auth repository of `@bg/firebase-api`
 * (BG-014 D2). Named imports so the Auth chunk keeps tree-shaking.
 */
export const webAuthSdk: AuthSdk<User> = {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  emailCredential: (email, password) => EmailAuthProvider.credential(email, password),
};
