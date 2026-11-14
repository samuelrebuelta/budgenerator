/* Native modules that have no JavaScript implementation under Jest. */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

/** Auth state the tests control through `setMockUser`. */
const mockAuth: { user: { uid: string } | null } = { user: null };
(globalThis as { __mockAuth?: typeof mockAuth }).__mockAuth = mockAuth;

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ options: { projectId: 'demo-budgenerator' } }),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({}),
  connectAuthEmulator: jest.fn(),
  onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => {
    next((globalThis as { __mockAuth?: { user: unknown } }).__mockAuth?.user ?? null);
    return () => undefined;
  },
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  connectFirestoreEmulator: jest.fn(),
}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: jest.fn(),
}));

// react-native-mmkv uses its own in-memory mock under Jest; only its Nitro loader needs a stub.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn() },
}));
