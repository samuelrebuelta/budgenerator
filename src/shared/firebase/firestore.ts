import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseApp, useFirebaseEmulators } from './app';

function createFirestore(): Firestore {
  const db = getFirestore(firebaseApp);
  if (useFirebaseEmulators)
    connectFirestoreEmulator(
      db,
      import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8180),
    );
  return db;
}

// Pure so that modules which only need Auth (login, public routes) do not pull Firestore.
export const db = /* @__PURE__ */ createFirestore();
