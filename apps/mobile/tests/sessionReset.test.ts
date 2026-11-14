/**
 * D3 (BG-014): closing a session leaves nothing of the previous UID on the device. The native
 * cache cannot run under Jest, so Firestore and Auth are mocks that model the disk cache; the
 * real behaviour was checked on the simulator (docs/specs/plans/2026-11-14-bg-014-spikes.md).
 */
const mockCalls: string[] = [];
const mockCache = new Map<string, unknown>();
const mockAuthState: { currentUser: { uid: string } | null } = { currentUser: null };
let mockTerminated = false;

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  connectFirestoreEmulator: jest.fn(() => mockCalls.push('connectFirestoreEmulator')),
  terminate: jest.fn(async () => {
    mockCalls.push('terminate');
    mockTerminated = true;
  }),
  clearPersistence: jest.fn(async () => {
    mockCalls.push('clearPersistence');
    // Like the native SDKs: clearing a running instance fails.
    if (!mockTerminated) throw new Error('failed-precondition');
    mockCache.clear();
  }),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => mockAuthState,
  connectAuthEmulator: jest.fn(),
  signOut: jest.fn(async () => {
    mockCalls.push('signOut');
    mockAuthState.currentUser = null;
  }),
}));

import {
  resetSession,
  SessionResetError,
  type SessionResetPort,
} from '../src/platform/sessionReset';
import { deleteUserStorage, userStorage, userStorageId } from '../src/platform/userStorage';

beforeEach(() => {
  mockCalls.length = 0;
  mockCache.clear();
  mockTerminated = false;
  mockAuthState.currentUser = null;
});

describe('resetSession con los módulos nativos (mocks)', () => {
  it('borra la caché de Firestore y el MMKV del UID antes de cerrar la sesión', async () => {
    mockAuthState.currentUser = { uid: 'alice' };
    mockCache.set('users/alice/budgets/b1', { clientName: 'Cliente de Alice' });
    userStorage('alice').set('lastTab', 'projects');
    userStorage('bob').set('lastTab', 'team');

    await resetSession('alice');

    expect(mockCalls).toEqual([
      'terminate',
      'clearPersistence',
      'connectFirestoreEmulator',
      'signOut',
    ]);
    expect(mockCache.size).toBe(0);
    expect(userStorage('alice').getAllKeys()).toEqual([]);
    // Other accounts' storage on the device is not touched.
    expect(userStorage('bob').getString('lastTab')).toBe('team');
    expect(mockAuthState.currentUser).toBeNull();
  });

  it('no llama a signOut si ya no hay usuario (RNFB lo rechazaría)', async () => {
    await resetSession(null);
    expect(mockCalls).toEqual(['terminate', 'clearPersistence', 'connectFirestoreEmulator']);
  });
});

describe('resetSession: orden y errores', () => {
  function fakePort(overrides: Partial<SessionResetPort> = {}) {
    const steps: string[] = [];
    const port: SessionResetPort = {
      terminateFirestore: async () => void steps.push('terminate'),
      clearFirestorePersistence: async () => void steps.push('clear'),
      reattachFirestore: () => void steps.push('reattach'),
      deleteUserStorage: (uid) => void steps.push(`mmkv:${uid}`),
      signOut: async () => void steps.push('signOut'),
      ...overrides,
    };
    return { port, steps };
  }

  it('sigue el orden terminate → clearPersistence → emulador → MMKV → signOut', async () => {
    const { port, steps } = fakePort();
    await resetSession('alice', port);
    expect(steps).toEqual(['terminate', 'clear', 'reattach', 'mmkv:alice', 'signOut']);
  });

  it('si falla un paso, completa el resto, cierra la sesión y lo informa', async () => {
    const { port, steps } = fakePort({
      clearFirestorePersistence: async () => {
        throw new Error('disk');
      },
    });
    const error = await resetSession('alice', port).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(SessionResetError);
    expect((error as SessionResetError).failures.map(({ step }) => step)).toEqual([
      'clearFirestorePersistence',
    ]);
    expect(steps).toEqual(['terminate', 'reattach', 'mmkv:alice', 'signOut']);
  });

  it('no intenta clearPersistence sobre una instancia que no se pudo terminar', async () => {
    const { port, steps } = fakePort({
      terminateFirestore: async () => {
        throw new Error('busy');
      },
    });
    await expect(resetSession('alice', port)).rejects.toBeInstanceOf(SessionResetError);
    expect(steps).toEqual(['reattach', 'mmkv:alice', 'signOut']);
  });
});

describe('userStorage', () => {
  it('usa un fichero MMKV por UID y rechaza identificadores con barra', () => {
    expect(userStorageId('alice')).toBe('user.alice');
    expect(() => userStorageId('a/b')).toThrow();
    userStorage('carol').set('k', 'v');
    expect(deleteUserStorage('carol')).toBe(true);
    expect(userStorage('carol').getAllKeys()).toEqual([]);
  });
});
