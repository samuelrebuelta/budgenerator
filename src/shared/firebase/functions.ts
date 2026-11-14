import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import type { FunctionsPort } from '@bg/firebase-api/functionsPort';
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

/** Callables of the web Functions instance for the shared repositories (`@bg/firebase-api`). */
export const webFunctions: FunctionsPort = {
  httpsCallable: (name, options) => httpsCallable(functions, name, options),
};
