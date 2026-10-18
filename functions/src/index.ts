import { onCall } from 'firebase-functions/v2/https';
import {
  getNotificationSettings as getNotificationSettingsHandler,
  registerPushDevice as registerPushDeviceHandler,
  revokePushDevice as revokePushDeviceHandler,
  setNotificationPreferences as setNotificationPreferencesHandler,
  notificationFunctionOptions,
} from './notifications/preferences.js';
import { requireNotificationOwnerUid } from './notifications/contracts.js';
export {
  cleanupLeadNotificationJobs,
  processNewLeadNotifications,
  recoverLeadNotificationJobs,
} from './notifications/leadCreated.js';
import {
  calculatePublicEstimate as calculatePublicEstimateHandler,
  getOwnerEstimatorStatus as getOwnerEstimatorStatusHandler,
  getPublicEstimator as getPublicEstimatorHandler,
  publishPublicEstimator as publishPublicEstimatorHandler,
  quoteEstimatorFunctionOptions,
  requireOwnerUid,
  revokePublicEstimator as revokePublicEstimatorHandler,
  submitPublicLead as submitPublicLeadHandler,
} from './quoteEstimator.js';

export const publishPublicEstimator = onCall(quoteEstimatorFunctionOptions, async (request) => {
  const uid = requireOwnerUid(request.auth?.uid);
  return publishPublicEstimatorHandler(uid);
});

export const revokePublicEstimator = onCall(quoteEstimatorFunctionOptions, async (request) => {
  const uid = requireOwnerUid(request.auth?.uid);
  return revokePublicEstimatorHandler(uid);
});

export const getOwnerEstimatorStatus = onCall(quoteEstimatorFunctionOptions, async (request) => {
  const uid = requireOwnerUid(request.auth?.uid);
  return getOwnerEstimatorStatusHandler(uid);
});

export const getPublicEstimator = onCall(quoteEstimatorFunctionOptions, (request) =>
  getPublicEstimatorHandler(request.data),
);

export const calculatePublicEstimate = onCall(quoteEstimatorFunctionOptions, (request) =>
  calculatePublicEstimateHandler(request.data),
);

export const submitPublicLead = onCall(quoteEstimatorFunctionOptions, (request) =>
  submitPublicLeadHandler(request.data),
);

export const getNotificationSettings = onCall(notificationFunctionOptions, (request) =>
  getNotificationSettingsHandler(requireNotificationOwnerUid(request.auth?.uid)),
);

export const setNotificationPreferences = onCall(notificationFunctionOptions, (request) =>
  setNotificationPreferencesHandler(requireNotificationOwnerUid(request.auth?.uid), request.data),
);

export const registerPushDevice = onCall(notificationFunctionOptions, (request) =>
  registerPushDeviceHandler(requireNotificationOwnerUid(request.auth?.uid), request.data),
);

export const revokePushDevice = onCall(notificationFunctionOptions, async (request) => ({
  revoked: await revokePushDeviceHandler(
    requireNotificationOwnerUid(request.auth?.uid),
    request.data?.installationId,
  ),
}));
