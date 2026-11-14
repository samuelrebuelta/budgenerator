/**
 * Native adapters of the `@bg/app-core` ports (BG-014 fase 1): MMKV for the offline cache and
 * the drafts, NetInfo for connectivity and expo-image-manipulator for the logo. MMKV runs on its
 * own in-memory Jest mock; NetInfo and the manipulator are mocked here.
 */
const mockNetInfoListeners: ((state: unknown) => void)[] = [];
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: (state: unknown) => void) => {
      mockNetInfoListeners.push(listener);
      return () => mockNetInfoListeners.splice(mockNetInfoListeners.indexOf(listener), 1);
    },
  },
}));

const mockSaves: { format: string; compress: number }[] = [];
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp', JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => ({
        renderAsync: async () => ({
          saveAsync: async ({ format, compress }: { format: string; compress: number }) => {
            mockSaves.push({ format, compress });
            // Too big until the JPEG at 0.9.
            return { base64: format === 'jpeg' ? 'small' : 'x'.repeat(200_000) };
          },
        }),
      }),
    }),
  },
}));

import { networkStore } from '@bg/app-core/network';
import {
  deleteOfflineUserData,
  readOfflineValue,
  writeOfflineValue,
} from '@bg/app-core/offlineStateCache';
import { createBudgetStore } from '@bg/app-core/stores/budget';
import { setSessionUid } from '@bg/app-core/session';
import { installNativePlatform, mmkvDraftStorage } from '../src/platform/appCore';
import { isOnlineState } from '../src/platform/connectivity';
import { manipulatorLogoNormalizer } from '../src/platform/imageNormalizer';
import { accountOfKey, mmkvKeyValueStore } from '../src/platform/keyValueStore';
import { deleteUserStorage, userStorage } from '../src/platform/userStorage';

const stop = installNativePlatform();
afterAll(() => stop());

describe('MMKV como KeyValueStore de la caché offline', () => {
  it('guarda cada clave de cuenta en el MMKV de su UID', async () => {
    expect(accountOfKey('session:alice:projects')).toBe('alice');
    expect(accountOfKey('resource:private:bob:project:p1')).toBe('bob');
    expect(accountOfKey('resource:public:x')).toBeNull();

    await writeOfflineValue('session:alice:projects', { projects: ['p1'] });
    await writeOfflineValue('resource:private:bob:leads', ['l1']);

    expect(userStorage('alice').getAllKeys()).toEqual(['session:alice:projects']);
    expect(userStorage('bob').getAllKeys()).toEqual(['resource:private:bob:leads']);
    await expect(mmkvKeyValueStore.getAll('session:alice:')).resolves.toEqual([
      expect.objectContaining({ key: 'session:alice:projects', value: { projects: ['p1'] } }),
    ]);
  });

  it('resetSession (deleteUserStorage) deja la caché de esa cuenta vacía y no toca otras', async () => {
    await writeOfflineValue('session:carol:projects', { projects: ['c'] });
    await writeOfflineValue('session:dave:projects', { projects: ['d'] });

    deleteUserStorage('carol');

    await expect(mmkvKeyValueStore.get('session:carol:projects')).resolves.toBeUndefined();
    await expect(readOfflineValue('session:dave:projects')).resolves.toEqual({ projects: ['d'] });
    await deleteOfflineUserData('dave');
    expect(userStorage('dave').getAllKeys()).toEqual([]);
  });
});

describe('borradores en MMKV', () => {
  it('el store compartido guarda y descarta el borrador en el MMKV de la cuenta', () => {
    setSessionUid('erin');
    const budget = createBudgetStore({
      repository: {
        fetchBudgets: jest.fn(),
        fetchBudget: jest.fn(),
        saveBudget: jest.fn(),
        createBudget: jest.fn(),
        deleteBudgetDoc: jest.fn(),
      },
      acceptance: jest.fn(),
      user: { canCreateBudget: () => true, setUserData: jest.fn() },
      drafts: mmkvDraftStorage,
    });
    budget.store.getState().startDraft();
    budget.store.getState().updateInfo({ clientName: 'Cliente en el móvil' });

    expect(mmkvDraftStorage.keys('cimbra-draft:erin:')).toEqual(['cimbra-draft:erin:budget']);
    expect(userStorage('erin').getString('cimbra-draft:erin:budget')).toContain(
      'Cliente en el móvil',
    );
    budget.store.getState().discardDraft();
    expect(mmkvDraftStorage.keys('cimbra-draft:erin:')).toEqual([]);
  });
});

describe('NetInfo como ConnectivityPort', () => {
  it('traduce el estado de NetInfo y lo lleva al store de red', () => {
    expect(isOnlineState({ isConnected: null, isInternetReachable: null })).toBeUndefined();
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isOnlineState({ isConnected: true, isInternetReachable: null })).toBe(true);

    mockNetInfoListeners.forEach((listener) =>
      listener({ isConnected: false, isInternetReachable: false }),
    );
    expect(networkStore.getState()).toMatchObject({ online: false, browserOnline: false });
    mockNetInfoListeners.forEach((listener) =>
      listener({ isConnected: true, isInternetReachable: true }),
    );
    expect(networkStore.getState()).toMatchObject({ online: true, recoverySource: 'browser' });
  });
});

describe('logo con expo-image-manipulator', () => {
  it('prueba WebP y JPEG por calidad y devuelve el primero que cabe', async () => {
    const dataUrl = await manipulatorLogoNormalizer({
      uri: 'file:///logo.png',
      width: 800,
      height: 400,
    });
    expect(dataUrl).toBe('data:image/jpeg;base64,small');
    expect(mockSaves.slice(0, 6).map(({ format }) => format)).toEqual([
      'webp',
      'webp',
      'webp',
      'webp',
      'webp',
      'jpeg',
    ]);
  });
});
