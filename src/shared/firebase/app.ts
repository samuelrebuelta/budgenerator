import { initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

if (useFirebaseEmulators && !firebaseConfig.projectId?.startsWith('demo-'))
  throw new Error('Los emuladores requieren un proyecto demo- para evitar acceder a producción.');

export const firebaseApp = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;

/**
 * App Check is enabled only when a reCAPTCHA site key is configured. Without it
 * (local development, E2E with emulators) the app works as before and the
 * Functions in `monitor` mode just log the missing token.
 */
export const appCheckEnabled = Boolean(appCheckSiteKey) && !useFirebaseEmulators;
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
