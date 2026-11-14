import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBudgetStore } from '../src/stores/budget';
import { createProfileStore } from '../src/stores/profile';
import { configureOfflineStorage } from '../src/offlineStateCache';
import { setSessionUid } from '../src/session';
import { setConnectivityPort } from '../src/network';
import { user } from '../../domain/tests/fixtures';
import { memoryDraftStorage } from './memoryPorts';

describe('stores con repositorios y puertos inyectados', () => {
  beforeEach(() => {
    configureOfflineStorage(null);
    setConnectivityPort({ isOnline: () => true });
    setSessionUid('alice');
  });

  it('el borrador del presupuesto se guarda en DraftStorage con la clave de la cuenta', async () => {
    const { drafts, items } = memoryDraftStorage();
    const setUserData = vi.fn();
    const budget = createBudgetStore({
      repository: {
        fetchBudgets: vi.fn(async () => []),
        fetchBudget: vi.fn(),
        saveBudget: vi.fn(),
        deleteBudgetDoc: vi.fn(),
        createBudget: vi.fn(async (_uid, record) => ({
          userData: user(),
          record: { ...record, revision: 1, number: 1 },
        })),
      },
      acceptance: vi.fn(),
      user: { canCreateBudget: () => true, setUserData },
      drafts,
    });

    budget.store.getState().startDraft();
    budget.store.getState().updateInfo({ clientName: 'Cliente del borrador' });
    expect(JSON.parse(items.get('cimbra-draft:alice:budget')!).document.business.clientName).toBe(
      'Cliente del borrador',
    );

    const id = await budget.store.getState().saveDraft();
    expect(id).toBeTruthy();
    expect(items.size).toBe(0);
    expect(setUserData).toHaveBeenCalledWith(user());
    expect(budget.store.getState().records.map((record) => record.id)).toEqual([id]);
    budget.reset();
    expect(budget.store.getState().records).toEqual([]);
  });

  it('el logo pasa por el ImageNormalizer de la plataforma antes de guardarse', async () => {
    const saveProfile = vi.fn(async () => undefined);
    const normalizeLogo = vi.fn(async (uri: string) => `data:image/webp;base64,${uri}`);
    const profile = createProfileStore<string>({
      repository: { fetchProfile: vi.fn(async () => null), saveProfile },
      normalizeLogo,
    });

    await profile.store.getState().uploadLogo('file:///logo.png');

    expect(normalizeLogo).toHaveBeenCalledWith('file:///logo.png');
    expect(saveProfile).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ logo: 'data:image/webp;base64,file:///logo.png' }),
    );
    expect(profile.store.getState().dirty).toBe(false);
  });
});
