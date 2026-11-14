import { useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import { isValidPrivacyPolicyUrl } from '@/entities/quote-estimator';
import type { EstimatorRequirements } from './estimatorSharing';

export function useEstimatorRequirements(): EstimatorRequirements {
  const emailVerified = useAuthStore((state) => state.emailVerified);
  const profile = useProfileStore((state) => state.profile);
  return {
    emailVerified,
    companyName: Boolean(profile.name?.trim()),
    privacyNotice: isValidPrivacyPolicyUrl(profile.privacyPolicyUrl),
  };
}
