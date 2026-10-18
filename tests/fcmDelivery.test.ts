import { describe, expect, it } from 'vitest';
import * as fcm from '../functions/src/notifications/fcm';

type FcmFailureDetails = {
  providerCode: string;
  deliveryCode:
    'push_fid_invalid' | 'push_registration_token_invalid' | 'push_delivery_unavailable';
  retryable: boolean;
};

const classifyFcmFailure = (
  fcm as unknown as { classifyFcmFailure?: (error: unknown) => FcmFailureDetails }
).classifyFcmFailure;

describe('FCM delivery diagnostics', () => {
  it('preserves the provider code when FCM rejects an installation ID', () => {
    expect(classifyFcmFailure).toBeTypeOf('function');
    expect(classifyFcmFailure?.({ code: 'messaging/installation-id-not-registered' })).toEqual({
      providerCode: 'messaging/installation-id-not-registered',
      deliveryCode: 'push_fid_invalid',
      retryable: false,
    });
  });

  it('keeps unexpected FCM failures retryable while preserving their provider code', () => {
    expect(classifyFcmFailure?.({ code: 'messaging/third-party-auth-error' })).toEqual({
      providerCode: 'messaging/third-party-auth-error',
      deliveryCode: 'push_delivery_unavailable',
      retryable: true,
    });
  });

  it('classifies an unregistered FCM registration token as invalid', () => {
    expect(classifyFcmFailure?.({ code: 'messaging/registration-token-not-registered' })).toEqual({
      providerCode: 'messaging/registration-token-not-registered',
      deliveryCode: 'push_registration_token_invalid',
      retryable: false,
    });
  });
});
