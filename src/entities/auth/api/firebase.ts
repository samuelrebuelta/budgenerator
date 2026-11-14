import type { User } from 'firebase/auth';
import { createAuthRepository } from '@bg/firebase-api/auth';
import { auth } from '@/shared/firebase/auth';
import { webAuthSdk } from '@/shared/firebase/authSdk';
import { webFunctions } from '@/shared/firebase/functions';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared auth repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createAuthRepository<User>({
  sdk: webAuthSdk,
  auth,
  functions: webFunctions,
  guardMutation: guardNetworkMutation,
});

export const {
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
} = repository;
