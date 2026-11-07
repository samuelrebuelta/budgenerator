import { create } from 'zustand';
import { fetchProfile, saveProfile } from '@/entities/profile/api/firestore';
import { WriteQueue } from '@/shared/lib/writeQueue';
import { registerOfflineStore } from '@/shared/lib/offlineStateCache';
import { withTimeout, isSessionCurrent, sessionRevision, sessionUid } from '@/shared/model/session';
import type { CompanyProfile } from '@/shared/types';

const writes = new WriteQueue<CompanyProfile>('profile:', (uid, profile) =>
  saveProfile(uid, profile),
);

export function setProfileAuthGetter(_fn: () => string) {
  void _fn;
}
const getUid = sessionUid;
export function resetProfileStore() {
  writes.clear();
  useProfileStore.setState({ profile: { ...EMPTY_PROFILE }, loaded: false, dirty: false });
}

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  cif: '',
  address: '',
  phone: '',
  email: '',
};

async function fileToBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await withTimeout(image.decode(), 5000);
    const ratio = Math.min(1, 1024 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Imagen no compatible.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface ProfileState {
  profile: CompanyProfile;
  loaded: boolean;
  dirty: boolean;
  loadProfile: (uid: string, authEmail?: string) => Promise<void>;
  updateProfile: (patch: Partial<CompanyProfile>) => void;
  saveProfile: () => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  removeLogo: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: { ...EMPTY_PROFILE },
  loaded: false,
  dirty: false,

  loadProfile: async (uid, authEmail?: string) => {
    if (get().dirty) {
      set({ loaded: true });
      return;
    }
    const revision = sessionRevision();
    const data = await fetchProfile(uid);
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
    const uid = getUid?.();
    if (!uid) return;
    const { profile } = get();
    writes.schedule(uid, profile);
    await withTimeout(writes.flush());
    if (get().profile === profile) set({ dirty: false });
  },

  uploadLogo: async (file) => {
    const uid = getUid?.();
    if (!uid) return;
    const revision = sessionRevision();
    const dataUrl = await fileToBase64(file);
    if (!isSessionCurrent(uid, revision)) return;
    set((s) => ({ profile: { ...s.profile, logo: dataUrl }, dirty: true }));
    await get().saveProfile();
  },

  removeLogo: async () => {
    const uid = getUid?.();
    if (!uid) return;
    set((s) => ({ profile: { ...s.profile, logo: '' }, dirty: true }));
    await get().saveProfile();
  },
}));

registerOfflineStore('profile', useProfileStore, getUid, (state) => ({
  profile: state.profile,
  loaded: state.loaded,
  dirty: state.dirty,
}));
