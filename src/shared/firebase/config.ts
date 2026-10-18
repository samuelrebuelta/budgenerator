import { initializeApp } from 'firebase/app';
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
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
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
