import { getMessaging, type FidMessage, type TokenMessage } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/logger';
import { NotificationDeliveryError, type PushNotificationInput } from './delivery.js';

type FcmFailureDetails = {
  providerCode: string;
  deliveryCode:
    'push_fid_invalid' | 'push_registration_token_invalid' | 'push_delivery_unavailable';
  retryable: boolean;
};

export function classifyFcmFailure(error: unknown): FcmFailureDetails {
  return typeof error === 'object' && error !== null && 'code' in error
    ? classifyProviderCode(String((error as { code?: unknown }).code ?? ''))
    : classifyProviderCode('');
}

function classifyProviderCode(providerCode: string): FcmFailureDetails {
  const invalidInstallation = providerCode === 'messaging/installation-id-not-registered';
  const invalidRegistrationToken =
    providerCode === 'messaging/registration-token-not-registered' ||
    providerCode === 'messaging/invalid-registration-token';
  return {
    providerCode: providerCode || 'unknown',
    deliveryCode: invalidInstallation
      ? 'push_fid_invalid'
      : invalidRegistrationToken
        ? 'push_registration_token_invalid'
        : 'push_delivery_unavailable',
    retryable: !invalidInstallation && !invalidRegistrationToken,
  };
}

const LEAD_NOTIFICATION_TITLE = 'Nueva solicitud de presupuesto';
const LEAD_NOTIFICATION_BODY = 'Abre BudGenerator para ver los detalles.';

/**
 * Builds the FCM message for the registered platform.
 *
 * - Web keeps the data-only payload: the service worker shows fixed copy, and a
 *   `notification` block would make the FCM SDK display a duplicate.
 * - iOS and Android need a `notification` block to be shown while the app is
 *   closed, plus APNs/Android options. No personal data goes in the payload.
 */
export function buildPushMessage(input: PushNotificationInput): FidMessage | TokenMessage {
  const target =
    'registrationToken' in input ? { token: input.registrationToken } : { fid: input.fid };
  const data = { jobId: input.jobId, leadId: input.leadId, type: 'lead_created' };
  const platform = input.platform ?? 'web';
  if (platform === 'web') {
    return { ...target, data, webpush: { headers: { TTL: '3600' } } };
  }
  return {
    ...target,
    data,
    notification: { title: LEAD_NOTIFICATION_TITLE, body: LEAD_NOTIFICATION_BODY },
    android: {
      priority: 'high',
      ttl: 3_600_000,
      collapseKey: 'lead_created',
      notification: { channelId: 'leads', tag: 'lead_created' },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      },
      payload: { aps: { sound: 'default', threadId: 'leads' } },
    },
  };
}

export async function sendPushNotification(input: PushNotificationInput) {
  const message = buildPushMessage(input);
  try {
    return { messageId: await getMessaging().send(message) };
  } catch (error) {
    const failure = classifyFcmFailure(error);
    logger.warn('FCM push delivery failed', {
      event: 'push_delivery_failed',
      providerCode: failure.providerCode,
      platform: input.platform ?? 'web',
      retryable: failure.retryable,
    });
    throw new NotificationDeliveryError(failure.deliveryCode, failure.retryable);
  }
}
