import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  getNotificationSettings as getNotificationSettingsHandler,
  registerPushDevice as registerPushDeviceHandler,
  revokePushDevice as revokePushDeviceHandler,
  setNotificationPreferences as setNotificationPreferencesHandler,
} from './notifications/preferences.js';
export {
  cleanupLeadNotificationJobs,
  cleanupPushDevices,
  processNewLeadNotifications,
  recoverLeadNotificationJobs,
} from './notifications/leadCreated.js';
import {
  calculatePublicEstimate as calculatePublicEstimateHandler,
  getOwnerEstimatorStatus as getOwnerEstimatorStatusHandler,
  getPublicEstimator as getPublicEstimatorHandler,
  publishPublicEstimator as publishPublicEstimatorHandler,
  resolvePublicEstimatorSlug as resolvePublicEstimatorSlugHandler,
  revokePublicEstimator as revokePublicEstimatorHandler,
  setPublicEstimatorPaused as setPublicEstimatorPausedHandler,
  submitPublicLead as submitPublicLeadHandler,
} from './quoteEstimator.js';
import { publishPrivacyNotice as publishPrivacyNoticeHandler } from './privacyNotice.js';
import { guardPublicEstimatorCall, guardPublicLeadCall } from './abuse/publicGuards.js';
import { deleteAccountData, exportAccountData } from './account/account.js';
import { requireRecentLogin, requireUid, requireVerifiedEmail } from './core/auth.js';
import {
  accountCallableOptions,
  authCallableOptions,
  publicCallableOptions,
  scheduleOptions,
} from './core/config.js';
import { observe } from './core/observability.js';
import { applyDataRetention } from './retention/retention.js';

const estimatorLogin = 'Inicia sesión para gestionar el enlace.';
const notificationsLogin = 'Inicia sesión para gestionar las notificaciones.';

// Owner estimator management. Publishing exposes data publicly, so it needs a verified email.
export const publishPublicEstimator = onCall(authCallableOptions, (request) =>
  observe('publishPublicEstimator', () =>
    publishPublicEstimatorHandler(requireVerifiedEmail(request)),
  ),
);

export const revokePublicEstimator = onCall(authCallableOptions, (request) =>
  observe('revokePublicEstimator', () =>
    revokePublicEstimatorHandler(requireUid(request, estimatorLogin)),
  ),
);

export const setPublicEstimatorPaused = onCall(authCallableOptions, (request) =>
  observe('setPublicEstimatorPaused', () =>
    setPublicEstimatorPausedHandler(requireUid(request, estimatorLogin), request.data),
  ),
);

// Hosted privacy notice for companies without a website. It is public, so it needs a verified email.
export const publishPrivacyNotice = onCall(authCallableOptions, (request) =>
  observe('publishPrivacyNotice', () => publishPrivacyNoticeHandler(requireVerifiedEmail(request))),
);

export const getOwnerEstimatorStatus = onCall(authCallableOptions, (request) =>
  observe('getOwnerEstimatorStatus', () =>
    getOwnerEstimatorStatusHandler(requireUid(request, estimatorLogin)),
  ),
);

// Public estimator: App Check (observe or enforce) and per-network/global limits first.
export const getPublicEstimator = onCall(publicCallableOptions, (request) =>
  observe('getPublicEstimator', async () => {
    await guardPublicEstimatorCall('getPublicEstimator', request);
    return getPublicEstimatorHandler(request.data);
  }),
);

export const resolvePublicEstimatorSlug = onCall(publicCallableOptions, (request) =>
  observe('resolvePublicEstimatorSlug', async () => {
    await guardPublicEstimatorCall('resolvePublicEstimatorSlug', request);
    return resolvePublicEstimatorSlugHandler(request.data);
  }),
);

export const calculatePublicEstimate = onCall(publicCallableOptions, (request) =>
  observe('calculatePublicEstimate', async () => {
    await guardPublicEstimatorCall('calculatePublicEstimate', request);
    return calculatePublicEstimateHandler(request.data);
  }),
);

export const submitPublicLead = onCall(publicCallableOptions, (request) =>
  observe('submitPublicLead', async () => {
    await guardPublicLeadCall(request);
    return submitPublicLeadHandler(request.data);
  }),
);

export const getNotificationSettings = onCall(authCallableOptions, (request) =>
  observe('getNotificationSettings', () =>
    getNotificationSettingsHandler(requireUid(request, notificationsLogin)),
  ),
);

export const setNotificationPreferences = onCall(authCallableOptions, (request) =>
  observe('setNotificationPreferences', () =>
    setNotificationPreferencesHandler(requireUid(request, notificationsLogin), request.data),
  ),
);

export const registerPushDevice = onCall(authCallableOptions, (request) =>
  observe('registerPushDevice', () =>
    registerPushDeviceHandler(requireUid(request, notificationsLogin), request.data),
  ),
);

export const revokePushDevice = onCall(authCallableOptions, (request) =>
  observe('revokePushDevice', async () => ({
    revoked: await revokePushDeviceHandler(
      requireUid(request, notificationsLogin),
      request.data?.installationId,
    ),
  })),
);

// RGPD: right of erasure and right of access.
export const deleteAccount = onCall(accountCallableOptions, (request) =>
  observe('deleteAccount', () => deleteAccountData(requireRecentLogin(request))),
);

export const exportAccount = onCall(accountCallableOptions, (request) =>
  observe('exportAccount', () => exportAccountData(requireUid(request))),
);

export const applyRetentionPolicies = onSchedule(
  { ...scheduleOptions, schedule: 'every day 03:30' },
  () =>
    observe('applyRetentionPolicies', async () => {
      await applyDataRetention();
    }),
);
