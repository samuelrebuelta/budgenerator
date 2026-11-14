import { createQuoteEstimatorRepository } from '@bg/firebase-api/quoteEstimator';
import { db } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { webFunctions } from '@/shared/firebase/functions';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

export type { HostedPrivacyNotice } from '@bg/firebase-api/quoteEstimator';

/** Web binding of the shared quote estimator repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createQuoteEstimatorRepository({
  sdk: webFirestoreSdk,
  database: db,
  functions: webFunctions,
  guardMutation: guardNetworkMutation,
});

export const {
  fetchQuoteEstimatorSettings,
  saveQuoteEstimatorSettings,
  deleteQuoteEstimatorSettings,
  publishEstimatorLink,
  revokeEstimatorLink,
  fetchEstimatorLinkStatus,
  setEstimatorPaused,
  resolveEstimatorShortLink,
  publishHostedPrivacyNotice,
  fetchHostedPrivacyNotice,
  fetchPublicEstimator,
  requestPublicEstimate,
  requestPublicLead,
  fetchLeads,
  fetchLead,
  deleteLead,
} = repository;
