import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { firebaseApp, useFirebaseEmulators } from './app';

/** Must match `FUNCTION_REGION` in functions/src/core/config.ts (same region as Firestore). */
export const FUNCTIONS_REGION =
  (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string | undefined) || 'europe-southwest1';

function createFunctions(): Functions {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
  if (useFirebaseEmulators)
    connectFunctionsEmulator(
      functions,
      '127.0.0.1',
      Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? 5001),
    );
  return functions;
}

export const functions = /* @__PURE__ */ createFunctions();
