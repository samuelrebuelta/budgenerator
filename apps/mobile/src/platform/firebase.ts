import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { Platform } from 'react-native';
import { appVariant } from './variant';

/** Callables live in Madrid, as on the web (`src/shared/firebase/functions.ts`). */
export const FUNCTIONS_REGION = 'europe-southwest1';

/**
 * Emulator ports: the repo defaults of `firebase.json` (same as the web), overridable when another
 * project already uses them (docs/testing.md, «Emuladores en puertos alternativos»). Metro inlines
 * `EXPO_PUBLIC_*` when it bundles, so restart it after changing them.
 */
export const EMULATOR_PORTS = {
  auth: Number(process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT ?? 9199),
  firestore: Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8180),
  functions: Number(process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT ?? 5001),
} as const;

/**
 * Host of the Firebase emulators seen from the device: the iOS simulator shares the Mac's
 * network (`localhost`) and the Android emulator reaches it through `10.0.2.2`. A physical device
 * on the LAN sets `EXPO_PUBLIC_EMULATOR_HOST` to the Mac's IP.
 */
export function emulatorHost(os: string = Platform.OS): string {
  const override = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  if (override) return override;
  return os === 'android' ? '10.0.2.2' : 'localhost';
}

let connected = false;

/**
 * Binds Firestore to the emulator in `development` (no-op elsewhere). Also called after
 * `terminate`: React Native Firebase then creates a new native instance without the binding.
 */
export function connectFirestoreToEmulator() {
  if (appVariant !== 'development') return;
  connectFirestoreEmulator(getFirestore(), emulatorHost(), EMULATOR_PORTS.firestore);
}

/**
 * Connects the native Firebase SDKs. In `development` they point at the local emulators and the
 * project must be a `demo-*` one; the other variants must never point at a demo project (same
 * guard as the web build, see docs/firebase.md).
 */
export function initFirebase() {
  if (connected) return;
  const projectId = getApp().options.projectId ?? '';
  const isDemo = projectId.startsWith('demo-');
  if (appVariant === 'development' && !isDemo) {
    throw new Error(`La variante development sólo usa emuladores demo-*; recibido "${projectId}".`);
  }
  if (appVariant !== 'development' && isDemo) {
    throw new Error(
      `La variante ${appVariant} no puede apuntar al proyecto de demo "${projectId}".`,
    );
  }
  if (appVariant === 'development') {
    const host = emulatorHost();
    connectAuthEmulator(getAuth(), `http://${host}:${EMULATOR_PORTS.auth}`);
    connectFirestoreToEmulator();
    connectFunctionsEmulator(
      getFunctions(getApp(), FUNCTIONS_REGION),
      host,
      EMULATOR_PORTS.functions,
    );
  }
  connected = true;
}
