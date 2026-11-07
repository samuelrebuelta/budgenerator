import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock('../src/entities/profile/api/firestore', () => mocks);
vi.mock('../src/shared/lib/writeQueue', () => ({
  WriteQueue: class {
    schedule = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
  },
}));
vi.mock('../src/shared/lib/offlineStateCache', () => ({ registerOfflineStore: vi.fn() }));

import { resetProfileStore, useProfileStore } from '../src/entities/profile/model/store';
import { setSessionUid } from '../src/shared/model/session';

describe('profile store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSessionUid('alice');
    resetProfileStore();
    mocks.fetchProfile.mockResolvedValue({ name: 'Remote', email: 'remote@example.test' });
    mocks.saveProfile.mockResolvedValue(undefined);
  });

  it('preserves an unsaved profile draft during a session refresh', async () => {
    useProfileStore.setState({
      profile: { name: 'Company', cif: '', address: '', phone: '', email: 'owner@example.test' },
      loaded: true,
    });
    useProfileStore.getState().updateProfile({ name: 'Draft name' });

    await useProfileStore.getState().loadProfile('alice', 'owner@example.test');

    expect(mocks.fetchProfile).not.toHaveBeenCalled();
    expect(useProfileStore.getState().profile.name).toBe('Draft name');
    expect(useProfileStore.getState().loaded).toBe(true);
  });

  it('keeps edits made while a profile refresh is in flight', async () => {
    let resolveProfile: ((profile: { name: string; email: string }) => void) | undefined;
    mocks.fetchProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );

    const loading = useProfileStore.getState().loadProfile('alice', 'owner@example.test');
    useProfileStore.getState().updateProfile({ name: 'Draft during refresh' });
    resolveProfile?.({ name: 'Remote', email: 'remote@example.test' });
    await loading;

    expect(useProfileStore.getState().profile.name).toBe('Draft during refresh');
  });

  it('allows a remote profile refresh after the draft has been saved', async () => {
    useProfileStore.getState().updateProfile({ name: 'Saved name' });
    await useProfileStore.getState().saveProfile();

    await useProfileStore.getState().loadProfile('alice', 'owner@example.test');

    expect(mocks.fetchProfile).toHaveBeenCalledWith('alice');
    expect(useProfileStore.getState().profile.name).toBe('Remote');
  });
});
