import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearMemoryResources,
  deleteMemoryResource,
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '../src/shared/lib/memoryResourceCache';
import {
  reportNetworkUnavailable,
  setNetworkOnline,
  useNetworkStore,
} from '../src/shared/model/network';

describe('memory resource cache', () => {
  beforeEach(() => {
    clearMemoryResources();
    setNetworkOnline(true);
  });

  it('keeps values in memory until explicitly cleared', () => {
    const projects = [{ id: 'project-a' }];
    setMemoryResource('alice:projects', projects);

    expect(getMemoryResource<typeof projects>('alice:projects')).toBe(projects);

    clearMemoryResources();
    expect(getMemoryResource('alice:projects')).toBeUndefined();
  });

  it('removes one cached value', () => {
    setMemoryResource('private:alice:lead:1', { id: '1' });

    deleteMemoryResource('private:alice:lead:1');

    expect(getMemoryResource('private:alice:lead:1')).toBeUndefined();
  });

  it('does not repopulate private cache when an in-flight read resolves after session reset', async () => {
    let resolveLoad!: (value: { id: string }) => void;
    const pending = loadMemoryResource(
      'private:alice:lead:1',
      () => new Promise((resolve) => (resolveLoad = resolve)),
    );

    clearMemoryResources();
    resolveLoad({ id: '1' });
    await pending;

    expect(getMemoryResource('private:alice:lead:1')).toBeUndefined();
  });

  it('probes the backend again after an unavailable error while the browser stays connected', async () => {
    reportNetworkUnavailable(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(
      loadMemoryResource('private:alice:projects', async () => ['current']),
    ).resolves.toEqual(['current']);

    expect(useNetworkStore.getState().online).toBe(true);
  });
});
