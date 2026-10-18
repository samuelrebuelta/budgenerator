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

export async function sendPushNotification(input: PushNotificationInput) {
  const target =
    'registrationToken' in input ? { token: input.registrationToken } : { fid: input.fid };
  const message: FidMessage | TokenMessage = {
    ...target,
    data: { jobId: input.jobId, leadId: input.leadId },
    webpush: { headers: { TTL: '3600' } },
  };
  try {
    return { messageId: await getMessaging().send(message) };
  } catch (error) {
    const failure = classifyFcmFailure(error);
    logger.warn('FCM push delivery failed', { providerCode: failure.providerCode });
    throw new NotificationDeliveryError(failure.deliveryCode, failure.retryable);
  }
}
