import { create } from 'zustand';
import { fetchProfile, saveProfile } from '@/shared/firebase';
import type { CompanyProfile } from '@/shared/types';

let getUid: (() => string) | null = null;

export function setProfileAuthGetter(fn: () => string) {
  getUid = fn;
}

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  cif: '',
  address: '',
  phone: '',
  email: '',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    const data = await fetchProfile(uid);
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
    await saveProfile(uid, profile);
  },

  uploadLogo: async (file) => {
    const uid = getUid?.();
    if (!uid) return;
    const dataUrl = await fileToBase64(file);
    set((s) => ({ profile: { ...s.profile, logo: dataUrl } }));
    await saveProfile(uid, get().profile);
  },

  removeLogo: async () => {
    const uid = getUid?.();
    if (!uid) return;
    set((s) => ({ profile: { ...s.profile, logo: '' } }));
    await saveProfile(uid, get().profile);
  },
}));
