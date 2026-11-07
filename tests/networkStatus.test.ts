import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { scheduleFlushWrites } = vi.hoisted(() => ({ scheduleFlushWrites: vi.fn() }));

vi.mock('../src/shared/model/sync', () => ({ scheduleFlushWrites }));

import {
  isNetworkUnavailable,
  isBrowserDisconnected,
  markNetworkAvailable,
  completeRecoveryRefresh,
  reportNetworkUnavailable,
  setNetworkOnline,
  useNetworkStore,
} from '../src/shared/model/network';

describe('network status', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    setNetworkOnline(true);
    vi.clearAllMocks();
  });

  it('marks the app disconnected after a Firebase network failure', () => {
    const error = Object.assign(new Error('offline'), { code: 'unavailable' });

    expect(reportNetworkUnavailable(error)).toBe(true);
    expect(useNetworkStore.getState().online).toBe(false);
    expect(useNetworkStore.getState().browserOnline).toBe(true);
    expect(isBrowserDisconnected()).toBe(false);
  });

  it.each([
    ['Firestore unavailable', Object.assign(new Error('offline'), { code: 'unavailable' })],
    [
      'callable unavailable',
      Object.assign(new Error('offline'), { code: 'functions/unavailable' }),
    ],
    ['failed request', Object.assign(new Error('offline'), { code: 'network-request-failed' })],
    ['fetch type error', new TypeError('Failed to fetch')],
  ])('recognizes %s as a network failure', (_label, error) => {
    expect(isNetworkUnavailable(error)).toBe(true);
  });

  it('does not mark an ordinary validation error as a network failure', () => {
    expect(reportNetworkUnavailable(new Error('Nombre no válido.'))).toBe(false);
    expect(useNetworkStore.getState().online).toBe(true);
  });

  it('schedules queued writes after Firebase recovers without a browser event', () => {
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    markNetworkAvailable();

    expect(scheduleFlushWrites).toHaveBeenCalledOnce();
  });

  it('increments one recovery version for a browser reconnection', () => {
    setNetworkOnline(false);
    const recoveryVersion = useNetworkStore.getState().recoveryVersion;

    setNetworkOnline(true);
    setNetworkOnline(true);

    expect(useNetworkStore.getState()).toMatchObject({
      recoveryVersion: recoveryVersion + 1,
      recoverySource: 'browser',
    });
  });

  it('records a session probe as the source when Firebase recovers', () => {
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    markNetworkAvailable('session');

    expect(useNetworkStore.getState()).toMatchObject({
      online: true,
      recoverySource: 'session',
    });
  });

  it('publishes a data refresh once per recovered connection', () => {
    setNetworkOnline(false);
    setNetworkOnline(true);
    const recoveryVersion = useNetworkStore.getState().recoveryVersion;

    completeRecoveryRefresh(recoveryVersion);
    completeRecoveryRefresh(recoveryVersion);

    expect(useNetworkStore.getState()).toMatchObject({
      dataRefreshVersion: 1,
      refreshedRecoveryVersion: recoveryVersion,
    });
  });

  it('keeps offline after a late response and flushes when the browser reconnects', () => {
    vi.stubGlobal('navigator', { onLine: false });
    setNetworkOnline(false);
    markNetworkAvailable();
    expect(useNetworkStore.getState()).toMatchObject({ online: false, browserOnline: false });

    vi.stubGlobal('navigator', { onLine: true });
    setNetworkOnline(true);

    expect(useNetworkStore.getState()).toMatchObject({ online: true, browserOnline: true });
    expect(scheduleFlushWrites).toHaveBeenCalledOnce();
  });
});
