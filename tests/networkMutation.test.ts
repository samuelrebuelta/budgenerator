import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runNetworkMutation } from '../src/shared/lib/networkMutation';
import {
  reportNetworkUnavailable,
  setNetworkOnline,
  useNetworkStore,
} from '../src/shared/model/network';
import { useToastStore } from '../src/shared/model/toast';

describe('network mutation guard', () => {
  beforeEach(() => {
    setNetworkOnline(true);
    useToastStore.setState({ toast: null, offlineNoticeShown: false });
  });

  it('does not start a mutation when the browser is disconnected', async () => {
    setNetworkOnline(false);
    const operation = vi.fn(async () => 'saved');

    await expect(runNetworkMutation(operation)).rejects.toMatchObject({
      name: 'OfflineMutationError',
    });

    expect(operation).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast?.message).toContain('Sin conexión');
  });

  it('marks the service unavailable and notifies when a mutation loses its connection', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(runNetworkMutation(operation)).rejects.toMatchObject({ code: 'unavailable' });

    expect(useNetworkStore.getState().online).toBe(false);
    expect(useToastStore.getState().toast?.message).toContain('Sin conexión');
  });

  it('retries after an earlier read marked the backend unavailable and restores online state', async () => {
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));
    const operation = vi.fn(async () => 'saved');

    await expect(runNetworkMutation(operation)).resolves.toBe('saved');

    expect(operation).toHaveBeenCalledOnce();
    expect(useNetworkStore.getState().online).toBe(true);
  });
});
