import { describe, expect, it } from 'vitest';
import {
  canRegisterPushDevice,
  parseNotificationPreferences,
  parsePushDeviceId,
  parsePushDeviceRegistration,
  requireNotificationOwnerUid,
} from '../functions/src/notifications/contracts';

const validInstallationId = 'a7c8f8b4-b42c-4c5c-9b4e-9f0d1a02c6f2';
const validToken = 'fcm-token-value-that-is-long-enough-for-registration';

describe('notification preference contracts', () => {
  it('accepts independent boolean preferences and rejects unknown fields', () => {
    expect(parseNotificationPreferences({ emailEnabled: true, pushEnabled: false })).toEqual({
      emailEnabled: true,
      pushEnabled: false,
    });
    expect(() =>
      parseNotificationPreferences({ emailEnabled: true, pushEnabled: false, email: 'owner@test' }),
    ).toThrow();
    expect(() =>
      parseNotificationPreferences({ emailEnabled: 'yes', pushEnabled: false }),
    ).toThrow();
  });

  it('validates device registration input without changing valid tokens', () => {
    expect(
      parsePushDeviceRegistration({ installationId: validInstallationId, token: validToken }),
    ).toEqual({ installationId: validInstallationId, token: validToken });
    expect(() =>
      parsePushDeviceRegistration({ installationId: 'not-an-id', token: validToken }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({ installationId: validInstallationId, token: 'short' }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({ installationId: validInstallationId, token: `${validToken} ` }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({
        installationId: validInstallationId,
        token: validToken,
        uid: 'bob',
      }),
    ).toThrow();
  });

  it('accepts only a device identifier from the authenticated session', () => {
    expect(parsePushDeviceId(validInstallationId)).toBe(validInstallationId);
    expect(() => parsePushDeviceId('another-users-device')).toThrow();
    expect(requireNotificationOwnerUid('owner-uid')).toBe('owner-uid');
    expect(() => requireNotificationOwnerUid(undefined)).toThrow();
  });

  it('allows refreshing an existing device at the ten-device limit but rejects an eleventh', () => {
    expect(canRegisterPushDevice(10, true)).toBe(true);
    expect(canRegisterPushDevice(9, false)).toBe(true);
    expect(canRegisterPushDevice(10, false)).toBe(false);
  });
});
