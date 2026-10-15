import { create } from 'zustand';
import { fetchProfile, saveProfile } from '@/entities/profile/api/firestore';
import { WriteQueue } from '@/shared/lib/writeQueue';
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
  useProfileStore.setState({ profile: { ...EMPTY_PROFILE }, loaded: false });
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
  loadProfile: (uid: string, authEmail?: string) => Promise<void>;
  updateProfile: (patch: Partial<CompanyProfile>) => void;
  saveProfile: () => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  removeLogo: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: { ...EMPTY_PROFILE },
  loaded: false,

  loadProfile: async (uid, authEmail?: string) => {
    const revision = sessionRevision();
    const data = await fetchProfile(uid);
    if (!isSessionCurrent(uid, revision)) return;
    const profile = data ?? { ...EMPTY_PROFILE };
    if (authEmail) profile.email = authEmail;
    set({ profile, loaded: true });
  },

  updateProfile: (patch) => {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
  },

  saveProfile: async () => {
    const uid = getUid?.();
    if (!uid) return;
    const { profile } = get();
    writes.schedule(uid, profile);
    await withTimeout(writes.flush());
  },

  uploadLogo: async (file) => {
    const uid = getUid?.();
    if (!uid) return;
    const revision = sessionRevision();
    const dataUrl = await fileToBase64(file);
    if (!isSessionCurrent(uid, revision)) return;
    set((s) => ({ profile: { ...s.profile, logo: dataUrl } }));
    await get().saveProfile();
  },

  removeLogo: async () => {
    const uid = getUid?.();
    if (!uid) return;
    set((s) => ({ profile: { ...s.profile, logo: '' } }));
    await get().saveProfile();
  },
}));
