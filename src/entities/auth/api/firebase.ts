import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/shared/firebase/auth';
import { functions } from '@/shared/firebase/functions';
import { runNetworkMutation } from '@/shared/lib/networkMutation';

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  // The account exists even if the email cannot be sent now; it can be resent from Mi cuenta.
  await sendEmailVerification(credential.user).catch(() => undefined);
  return credential;
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('No authenticated user');
  await sendEmailVerification(auth.currentUser);
}

/** Reloads the user and forces a new ID token so Rules see `email_verified`. */
export async function refreshEmailVerification() {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

/** Admins are identified only by the `admin` custom claim set with Admin SDK. */
export async function readAdminClaim(user: User) {
  try {
    // Offline with an expired token the refresh fails; never block the session on it.
    const result = await Promise.race([
      user.getIdTokenResult(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    return result.claims.admin === true;
  } catch {
    return false;
  }
}

async function reauthenticate(password: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  // The callable checks `auth_time`; make sure the new token is used.
  await user.getIdToken(true);
}

/** RGPD erasure: requires the password again, then deletes all data and the account. */
export async function deleteAccount(password: string) {
  await reauthenticate(password);
  const call = httpsCallable<void, { deleted: true }>(functions, 'deleteAccount', {
    timeout: 300_000,
  });
  await runNetworkMutation(() => call());
  await firebaseSignOut(auth).catch(() => undefined);
}

/** RGPD access: JSON copy of every document of the account. */
export async function exportAccountData() {
  const call = httpsCallable<void, unknown>(functions, 'exportAccount', { timeout: 300_000 });
  return (await call()).data;
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function sendPasswordReset(email: string) {
  return firebaseSendPasswordReset(auth, email);
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
