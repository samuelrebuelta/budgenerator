import { initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;

/**
 * App Check is enabled only when a reCAPTCHA site key is configured. Without it
 * (local development, E2E with emulators) the app works as before and the
 * Functions in `monitor` mode just log the missing token.
 */
export const appCheckEnabled = Boolean(appCheckSiteKey) && !useEmulators;
if (appCheckEnabled && appCheckSiteKey) {
  const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined;
  if (debugToken)
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken;
  initializeAppCheck(firebaseApp, {
    provider:
      import.meta.env.VITE_FIREBASE_APPCHECK_PROVIDER === 'v3'
        ? new ReCaptchaV3Provider(appCheckSiteKey)
        : new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

/** Must match `FUNCTION_REGION` in functions/src/core/config.ts (same region as Firestore). */
export const FUNCTIONS_REGION =
  (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string | undefined) || 'europe-southwest1';

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);

if (useEmulators) {
  if (!firebaseConfig.projectId?.startsWith('demo-'))
    throw new Error('Los emuladores requieren un proyecto demo- para evitar acceder a producción.');
  connectAuthEmulator(
    auth,
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9199',
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
    Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8180),
  );
  connectFunctionsEmulator(
    functions,
    '127.0.0.1',
    Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? 5001),
  );
}
