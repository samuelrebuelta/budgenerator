/* Native modules that have no JavaScript implementation under Jest. */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ options: { projectId: 'demo-budgenerator' } }),
}));
/* Native Auth (used by `resetSession`) acts on the same fake user as the auth repository. */
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({
    get currentUser() {
      return require('./fakeRepositories').authState.user;
    },
  }),
  connectAuthEmulator: jest.fn(),
  signOut: jest.fn(async () => require('./fakeRepositories').emitAuthUser(null)),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  connectFirestoreEmulator: jest.fn(),
  terminate: jest.fn(async () => undefined),
  clearPersistence: jest.fn(async () => undefined),
}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => undefined },
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

/* The screens run the real stores over in-memory repositories (tests/fakeRepositories.ts). */
jest.mock('../src/platform/repositories', () => ({
  createNativeRepositories: () => require('./fakeRepositories').createFakeRepositories(),
}));

// react-native-mmkv uses its own in-memory mock under Jest; only its Nitro loader needs a stub.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn() },
}));
