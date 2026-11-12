import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { firebaseApp, useFirebaseEmulators } from './app';

export const auth = getAuth(firebaseApp);

if (useFirebaseEmulators)
  connectAuthEmulator(
    auth,
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9199',
    { disableWarnings: true },
  );
