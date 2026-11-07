import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  flushWrites: vi.fn(),
  hasPendingWrites: vi.fn(),
  loadSession: vi.fn(),
}));

vi.mock('../src/shared/model/sync', () => ({
  flushWrites: fakes.flushWrites,
  hasPendingWrites: fakes.hasPendingWrites,
  scheduleFlushWrites: vi.fn(),
}));

vi.mock('../src/app/session', () => ({ loadSession: fakes.loadSession }));

import { refreshAfterNetworkRecovery } from '../src/app/refreshOnReconnect';
import { setNetworkOnline, useNetworkStore } from '../src/shared/model/network';
import type { User } from 'firebase/auth';

const user = { uid: 'alice', email: 'a@example.test' } as User;

describe('refresh after network recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.flushWrites.mockResolvedValue(undefined);
    fakes.hasPendingWrites.mockReturnValue(false);
    fakes.loadSession.mockResolvedValue(undefined);
    useNetworkStore.setState({
      online: true,
      browserOnline: true,
      recoveryVersion: 1,
      recoverySource: 'browser',
      dataRefreshVersion: 0,
      refreshedRecoveryVersion: 0,
    });
  });

  it('flushes queued writes before refreshing session data and the active route', async () => {
    const order: string[] = [];
    fakes.flushWrites.mockImplementation(async () => void order.push('writes'));
    fakes.loadSession.mockImplementation(async () => void order.push('session'));

    const refreshed = await refreshAfterNetworkRecovery(user, false);

    expect(refreshed).toBe(true);
    expect(order).toEqual(['writes', 'session']);
    expect(useNetworkStore.getState().dataRefreshVersion).toBe(1);
    expect(fakes.loadSession).toHaveBeenCalledWith(user, true, true);
  });

  it('retains local data when queued writes are still pending', async () => {
    fakes.hasPendingWrites.mockReturnValue(true);

    const refreshed = await refreshAfterNetworkRecovery(user, false);

    expect(refreshed).toBe(false);
    expect(fakes.loadSession).not.toHaveBeenCalled();
    expect(useNetworkStore.getState().dataRefreshVersion).toBe(0);
  });

  it('does not reload session stores already refreshed by the recovery probe', async () => {
    const refreshed = await refreshAfterNetworkRecovery(user, true);

    expect(refreshed).toBe(true);
    expect(fakes.flushWrites).not.toHaveBeenCalled();
    expect(fakes.loadSession).not.toHaveBeenCalled();
    expect(useNetworkStore.getState().dataRefreshVersion).toBe(1);
  });

  it('leaves the route refresh pending if Firebase becomes unavailable during refresh', async () => {
    fakes.loadSession.mockImplementation(async () => {
      setNetworkOnline(false);
    });

    const refreshed = await refreshAfterNetworkRecovery(user, false);

    expect(refreshed).toBe(false);
    expect(useNetworkStore.getState().dataRefreshVersion).toBe(0);
  });
});
