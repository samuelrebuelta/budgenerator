/**
 * Minimal Firebase Auth surface for the shared auth repository (BG-014 D2). The web injects the
 * modular `firebase/auth` functions and the app `@react-native-firebase/auth` (modular API,
 * v22+). As in `FirestoreSdk`, members use method syntax so each SDK's own `User` and `Auth`
 * classes fit structurally; the repository is generic over the platform `User` so the web keeps
 * exposing Firebase's `User` type to its components.
 */

/** Fields and methods of a Firebase `User` the repositories use. */
export interface AuthUserLike {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  reload(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(): Promise<{ claims: { [claim: string]: unknown } }>;
}

/** An `Auth` instance of either SDK; only `currentUser` is read directly. */
export interface AuthLike<TUser extends AuthUserLike = AuthUserLike> {
  readonly currentUser: TUser | null;
}

/** `EmailAuthProvider.credential(...)` result; only passed back to the SDK. */
export type AuthCredentialLike = object;

export interface UserCredentialLike<TUser extends AuthUserLike = AuthUserLike> {
  readonly user: TUser;
}

export interface AuthSdk<TUser extends AuthUserLike = AuthUserLike> {
  signInWithEmailAndPassword(
    auth: AuthLike<TUser>,
    email: string,
    password: string,
  ): Promise<UserCredentialLike<TUser>>;
  createUserWithEmailAndPassword(
    auth: AuthLike<TUser>,
    email: string,
    password: string,
  ): Promise<UserCredentialLike<TUser>>;
  signOut(auth: AuthLike<TUser>): Promise<void>;
  onAuthStateChanged(auth: AuthLike<TUser>, next: (user: TUser | null) => void): () => void;
  sendPasswordResetEmail(auth: AuthLike<TUser>, email: string): Promise<void>;
  sendEmailVerification(user: TUser): Promise<void>;
  reauthenticateWithCredential(user: TUser, credential: AuthCredentialLike): Promise<unknown>;
  updatePassword(user: TUser, newPassword: string): Promise<void>;
  /** `EmailAuthProvider.credential` of the platform SDK. */
  emailCredential(email: string, password: string): AuthCredentialLike;
}
