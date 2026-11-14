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

// Native views of the native design (README «Diseño nativo»): the tests render the fallbacks,
// i.e. the solid iOS look and the Feather glyphs.
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return {
    GlassView: View,
    GlassContainer: View,
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});
jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: unknown }) => fallback ?? null,
  unstable_getMaterialSymbolSourceAsync: async () => null,
}));

/** PDF output (`src/features/budgets/pdf.ts`): the file and the share sheet are native. */
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = false;
    constructor(_directory: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    create() {}
    delete() {}
    async write() {}
  }
  return { File, Paths: { cache: {}, document: {} } };
});
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

/** The swipe container needs Reanimated's native runtime; the row and its actions render as is. */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  const Swipeable = ({
    children,
    renderRightActions,
  }: {
    children?: unknown;
    renderRightActions?: () => unknown;
  }) => require('react').createElement(View, null, children, renderRightActions?.());
  return { __esModule: true, default: Swipeable };
});

/** Haptics are native; the tests check which feedback a mutation asks for. */
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

/** Native date picker: a host view that keeps its props, so tests fire `valueChange` on it. */
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  const Picker = (props: Record<string, unknown>) =>
    require('react').createElement(View, { ...props, testID: props.testID ?? 'date-picker' });
  return {
    __esModule: true,
    default: Picker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn(async () => true) },
  };
});
