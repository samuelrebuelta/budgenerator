import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { Platform } from 'react-native';
import { appVariant } from './variant';

/** Callables live in Madrid, as on the web (`src/shared/firebase/functions.ts`). */
export const FUNCTIONS_REGION = 'europe-southwest1';

const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001 } as const;

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
    connectFirestoreEmulator(getFirestore(), host, EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(
      getFunctions(getApp(), FUNCTIONS_REGION),
      host,
      EMULATOR_PORTS.functions,
    );
  }
  connected = true;
}
