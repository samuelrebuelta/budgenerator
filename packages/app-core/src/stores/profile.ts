import { createStore } from 'zustand/vanilla';
import type { CompanyProfile } from '@bg/domain/types';
import type { ProfileRepository } from '@bg/firebase-api/profile';
import type { ImageNormalizer } from '../ports.js';
import { WriteQueue } from '../writeQueue.js';
import { registerOfflineStore } from '../offlineStateCache.js';
import { withTimeout, isSessionCurrent, sessionRevision, sessionUid } from '../session.js';

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  cif: '',
  address: '',
  phone: '',
  email: '',
};

export interface ProfileState<TImage> {
  profile: CompanyProfile;
  loaded: boolean;
  dirty: boolean;
  loadProfile: (uid: string, authEmail?: string) => Promise<void>;
  updateProfile: (patch: Partial<CompanyProfile>) => void;
  saveProfile: () => Promise<void>;
  uploadLogo: (image: TImage) => Promise<void>;
  removeLogo: () => Promise<void>;
}

export interface ProfileStoreOptions<TImage> {
  repository: Pick<ProfileRepository, 'fetchProfile' | 'saveProfile'>;
  /** Resizes and encodes the picked logo (web: canvas, mobile: expo-image-manipulator). */
  normalizeLogo: ImageNormalizer<TImage>;
}

/** Company profile with a draft that survives refreshes until it is saved. */
export function createProfileStore<TImage>({
  repository,
  normalizeLogo,
}: ProfileStoreOptions<TImage>) {
  const writes = new WriteQueue<CompanyProfile>('profile:', (uid, profile) =>
    repository.saveProfile(uid, profile),
  );
  const getUid = sessionUid;

  const store = createStore<ProfileState<TImage>>()((set, get) => ({
    profile: { ...EMPTY_PROFILE },
    loaded: false,
    dirty: false,

    loadProfile: async (uid, authEmail?: string) => {
      if (get().dirty) {
        set({ loaded: true });
        return;
      }
      const revision = sessionRevision();
      const data = await repository.fetchProfile(uid);
      if (!isSessionCurrent(uid, revision)) return;
      if (get().dirty) {
        set({ loaded: true });
        return;
      }
      const profile = data ?? { ...EMPTY_PROFILE };
      if (authEmail) profile.email = authEmail;
      set({ profile, loaded: true });
    },

    updateProfile: (patch) => {
      set((s) => ({ profile: { ...s.profile, ...patch }, dirty: true }));
    },

    saveProfile: async () => {
      const uid = getUid();
      if (!uid) return;
      const { profile } = get();
      writes.schedule(uid, profile);
      await withTimeout(writes.flush());
      if (get().profile === profile) set({ dirty: false });
    },

    uploadLogo: async (image) => {
      const uid = getUid();
      if (!uid) return;
      const revision = sessionRevision();
      const dataUrl = await normalizeLogo(image);
      if (!isSessionCurrent(uid, revision)) return;
      set((s) => ({ profile: { ...s.profile, logo: dataUrl }, dirty: true }));
      await get().saveProfile();
    },

    removeLogo: async () => {
      const uid = getUid();
      if (!uid) return;
      set((s) => ({ profile: { ...s.profile, logo: '' }, dirty: true }));
      await get().saveProfile();
    },
  }));

  registerOfflineStore('profile', store, getUid, (state) => ({
    profile: state.profile,
    loaded: state.loaded,
    dirty: state.dirty,
  }));

  return {
    store,
    reset() {
      writes.clear();
      store.setState({ profile: { ...EMPTY_PROFILE }, loaded: false, dirty: false });
    },
  };
}
