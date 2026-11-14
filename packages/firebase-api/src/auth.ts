import type { AuthLike, AuthSdk, AuthUserLike } from './authPort.js';
import type { FunctionsPort } from './functionsPort.js';
import { runGuarded, unguardedMutation, type MutationGuard } from './firestorePort.js';

export interface AuthRepositoryOptions<TUser extends AuthUserLike> {
  sdk: AuthSdk<TUser>;
  auth: AuthLike<TUser>;
  /** Callables for the RGPD operations (`deleteAccount`, `exportAccount`). */
  functions: FunctionsPort;
  guardMutation?: MutationGuard;
  /** Admin claim read timeout; the session never waits longer for it offline. */
  adminClaimTimeoutMs?: number;
}

/**
 * Email/password authentication, email verification, reauthentication and the RGPD callables
 * (BG-014 D2). Generic over the platform `User` so each app keeps its SDK type.
 */
export function createAuthRepository<TUser extends AuthUserLike>({
  sdk,
  auth,
  functions,
  guardMutation = unguardedMutation,
  adminClaimTimeoutMs = 4000,
}: AuthRepositoryOptions<TUser>) {
  function signInWithEmail(email: string, password: string) {
    return sdk.signInWithEmailAndPassword(auth, email, password);
  }

  async function signUpWithEmail(email: string, password: string) {
    const credential = await sdk.createUserWithEmailAndPassword(auth, email, password);
    // The account exists even if the email cannot be sent now; it can be resent from Mi cuenta.
    await sdk.sendEmailVerification(credential.user).catch(() => undefined);
    return credential;
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) throw new Error('No authenticated user');
    await sdk.sendEmailVerification(auth.currentUser);
  }

  /** Reloads the user and forces a new ID token so Rules see `email_verified`. */
  async function refreshEmailVerification() {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    return user.emailVerified;
  }

  /** Admins are identified only by the `admin` custom claim set with Admin SDK. */
  async function readAdminClaim(user: TUser) {
    try {
      // Offline with an expired token the refresh fails; never block the session on it.
      const result = await Promise.race([
        user.getIdTokenResult(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), adminClaimTimeoutMs),
        ),
      ]);
      return result.claims.admin === true;
    } catch {
      return false;
    }
  }

  async function reauthenticate(password: string) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user');
    await sdk.reauthenticateWithCredential(user, sdk.emailCredential(user.email, password));
    // The callable checks `auth_time`; make sure the new token is used.
    await user.getIdToken(true);
  }

  /** RGPD erasure: requires the password again, then deletes all data and the account. */
  async function deleteAccount(password: string) {
    await reauthenticate(password);
    const call = functions.httpsCallable<void, { deleted: true }>('deleteAccount', {
      timeout: 300_000,
    });
    await runGuarded(guardMutation, () => call());
    await sdk.signOut(auth).catch(() => undefined);
  }

  /** RGPD access: JSON copy of every document of the account. */
  async function exportAccountData() {
    const call = functions.httpsCallable<void, unknown>('exportAccount', { timeout: 300_000 });
    return (await call()).data;
  }

  function signOut() {
    return sdk.signOut(auth);
  }

  function onAuthChange(callback: (user: TUser | null) => void) {
    return sdk.onAuthStateChanged(auth, callback);
  }

  function sendPasswordReset(email: string) {
    return sdk.sendPasswordResetEmail(auth, email);
  }

  async function refreshCurrentUser() {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    return auth.currentUser;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user');
    const credential = sdk.emailCredential(user.email, currentPassword);
    await sdk.reauthenticateWithCredential(user, credential);
    await sdk.updatePassword(user, newPassword);
  }

  return {
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    readAdminClaim,
    deleteAccount,
    exportAccountData,
    signOut,
    onAuthChange,
    sendPasswordReset,
    refreshCurrentUser,
    changePassword,
  };
}

export type AuthRepository<TUser extends AuthUserLike = AuthUserLike> = ReturnType<
  typeof createAuthRepository<TUser>
>;
