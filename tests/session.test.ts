import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  loadUserData: vi.fn(),
  loadBudgets: vi.fn(),
  loadCatalogs: vi.fn(),
  loadProfile: vi.fn(),
  loadProjects: vi.fn(),
  loadTemplates: vi.fn(),
  hasPendingWrites: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@/shared/model/sync', () => ({
  useSyncStore: { setState: vi.fn() },
  flushWrites: vi.fn(async () => {}),
  hasPendingWrites: fakes.hasPendingWrites,
  scheduleFlushWrites: vi.fn(),
}));
vi.mock('@/entities/budget', () => ({
  useBudgetStore: { getState: () => ({ loadBudgets: fakes.loadBudgets }) },
  resetBudgetStore: fakes.reset,
}));
vi.mock('@/entities/catalog', () => ({
  useCatalogStore: { getState: () => ({ loadCatalogs: fakes.loadCatalogs }) },
  resetCatalogStore: fakes.reset,
}));
vi.mock('@/entities/profile', () => ({
  useProfileStore: { getState: () => ({ loadProfile: fakes.loadProfile }) },
  resetProfileStore: fakes.reset,
}));
vi.mock('@/entities/project', () => ({
  useProjectStore: { getState: () => ({ loadProjects: fakes.loadProjects }) },
  resetProjectStore: fakes.reset,
}));
vi.mock('@/entities/workforce', () => ({ resetWorkforceStore: fakes.reset }));
vi.mock('@/entities/template', () => ({
  useTemplateStore: { getState: () => ({ loadTemplates: fakes.loadTemplates }) },
  resetTemplateStore: fakes.reset,
}));
vi.mock('@/entities/user', () => ({
  useUserStore: { getState: () => ({ loadUserData: fakes.loadUserData }) },
  resetUserStore: fakes.reset,
}));

import {
  loadSession,
  retryUnauthenticatedRouteConnection,
  probeSessionConnection,
  resetSession,
  useSessionStore,
} from '../src/app/session';
import {
  reportNetworkUnavailable,
  setNetworkOnline,
  useNetworkStore,
} from '../src/shared/model/network';
import { getMemoryResource, setMemoryResource } from '../src/shared/lib/memoryResourceCache';
import type { User } from 'firebase/auth';

describe('session offline startup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.loadUserData.mockRejectedValue(
      Object.assign(new Error('offline'), { code: 'unavailable' }),
    );
    fakes.loadBudgets.mockResolvedValue(undefined);
    fakes.loadCatalogs.mockResolvedValue(undefined);
    fakes.loadProfile.mockResolvedValue(undefined);
    fakes.loadProjects.mockResolvedValue(undefined);
    fakes.loadTemplates.mockResolvedValue(undefined);
    fakes.hasPendingWrites.mockReturnValue(false);
    resetSession(null);
    useSessionStore.setState({ uid: null, status: 'idle', error: null });
    setNetworkOnline(true);
  });

  it('clears private page snapshots when the account changes', () => {
    setMemoryResource('alice:leads', [{ id: 'lead-a' }]);

    resetSession('bob');

    expect(getMemoryResource('alice:leads')).toBeUndefined();
    expect(useNetworkStore.getState().online).toBe(true);
    expect(useSessionStore.getState().uid).toBe('bob');
    expect(useSessionStore.getState().status).toBe('idle');
  });

  it('opens the authenticated shell after a network-only startup failure', async () => {
    await loadSession({ uid: 'alice', email: 'a@example.test' } as User);

    expect(useNetworkStore.getState().online).toBe(false);
    expect(useSessionStore.getState()).toMatchObject({
      uid: 'alice',
      status: 'ready',
      error: null,
    });
  });

  it('restores network state after the session retry succeeds without a browser online event', async () => {
    fakes.loadUserData.mockResolvedValue(undefined);
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await loadSession({ uid: 'alice', email: 'a@example.test' } as User, true);

    expect(useNetworkStore.getState()).toMatchObject({ online: true, browserOnline: true });
  });

  it('uses a project read as a lightweight Firebase recovery probe', async () => {
    const user = { uid: 'alice', email: 'a@example.test' } as User;
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    const available = await probeSessionConnection(user);

    expect(available).toBe(true);
    expect(fakes.loadProjects).toHaveBeenCalledWith('alice', true);
    expect(useNetworkStore.getState()).toMatchObject({
      online: true,
      recoverySource: 'request',
    });
  });

  it('retries the active public route without reading private session data', () => {
    const previousRecoveryVersion = useNetworkStore.getState().recoveryVersion;
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    const available = retryUnauthenticatedRouteConnection();

    expect(available).toBe(true);
    expect(useNetworkStore.getState()).toMatchObject({
      online: true,
      recoverySource: 'request',
      recoveryVersion: previousRecoveryVersion + 1,
    });
    expect(fakes.loadProjects).not.toHaveBeenCalled();
  });

  it('keeps the authenticated shell ready while a background recovery probe is in flight', async () => {
    const user = { uid: 'alice', email: 'a@example.test' } as User;
    fakes.loadUserData.mockResolvedValue(undefined);
    await loadSession(user);
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    let finishProbe!: () => void;
    fakes.loadUserData.mockImplementation(
      () => new Promise<void>((resolve) => (finishProbe = resolve)),
    );
    const retry = loadSession(user, true);

    expect(useSessionStore.getState().status).toBe('ready');
    await vi.waitFor(() => expect(finishProbe).toBeTypeOf('function'));
    finishProbe();
    await retry;
    expect(useSessionStore.getState().status).toBe('ready');
  });
});
