import { canvasLogoNormalizer } from '@/shared/platform';
import { createProfileStore } from '@bg/app-core/stores/profile';
import * as profileApi from '@/entities/profile/api/firestore';
import { bindStore } from '@/shared/lib/bindStore';

/** Web binding of the shared profile store (`@bg/app-core`); logos are encoded on a canvas. */
const profile = createProfileStore<File>({
  repository: profileApi,
  normalizeLogo: canvasLogoNormalizer,
});

export const useProfileStore = bindStore(profile.store);
export const resetProfileStore = profile.reset;

export function setProfileAuthGetter(_fn: () => string) {
  void _fn;
}
