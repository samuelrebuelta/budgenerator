import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { firebaseApp, useFirebaseEmulators } from './app';

function createFunctions(): Functions {
  const functions = getFunctions(firebaseApp, 'europe-west1');
  if (useFirebaseEmulators)
    connectFunctionsEmulator(
      functions,
      '127.0.0.1',
      Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? 5001),
    );
  return functions;
}

export const functions = /* @__PURE__ */ createFunctions();
