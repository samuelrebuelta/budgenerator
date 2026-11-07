import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMemoryResources,
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
  OfflineReadUnavailableError,
} from '../src/shared/lib/memoryResourceCache';
import { setNetworkOnline, useNetworkStore } from '../src/shared/model/network';

describe('offline reads', () => {
  beforeEach(() => {
    clearMemoryResources();
    setNetworkOnline(true);
  });

  it('returns the last in-memory result without starting a read when offline', async () => {
    const cached = [{ id: 'lead-a' }];
    setMemoryResource('alice:leads', cached);
    setNetworkOnline(false);
    const read = vi.fn(async () => [{ id: 'lead-b' }]);

    await expect(loadMemoryResource('alice:leads', read)).resolves.toBe(cached);

    expect(read).not.toHaveBeenCalled();
  });

  it('restores the last persisted result after an offline reload', async () => {
    const cached = [{ id: 'project-a', title: 'Último estado guardado' }];
    await setMemoryResource('private:alice:projects', cached);
    clearMemoryResources();
    setNetworkOnline(false);
    const read = vi.fn(async () => [{ id: 'project-b', title: 'Estado nuevo' }]);

    await expect(loadMemoryResource('private:alice:projects', read)).resolves.toEqual(cached);

    expect(read).not.toHaveBeenCalled();
  });

  it('does not return one account resource under another account key', async () => {
    await setMemoryResource('private:alice:projects', [{ id: 'alice-project' }]);
    clearMemoryResources();
    setNetworkOnline(false);

    await expect(
      loadMemoryResource('private:bob:projects', async () => [{ id: 'bob-project' }]),
    ).rejects.toBeInstanceOf(OfflineReadUnavailableError);
  });

  it('retains cached data when a read reports unavailable despite the browser appearing online', async () => {
    const cached = { title: 'Último estado' };
    setMemoryResource('alice:project:one', cached);
    const read = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(loadMemoryResource('alice:project:one', read)).resolves.toBe(cached);

    expect(useNetworkStore.getState().online).toBe(false);
    expect(getMemoryResource('alice:project:one')).toBe(cached);
  });

  it('reports a clear no-data error instead of loading when offline without a cached result', async () => {
    setNetworkOnline(false);
    const read = vi.fn(async () => 'never called');

    await expect(loadMemoryResource('alice:unseen', read)).rejects.toBeInstanceOf(
      OfflineReadUnavailableError,
    );

    expect(read).not.toHaveBeenCalled();
  });
});
