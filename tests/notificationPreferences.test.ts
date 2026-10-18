import { describe, expect, it } from 'vitest';
import {
  canRegisterPushDevice,
  parseNotificationPreferences,
  parsePushDeviceId,
  parsePushDeviceRegistration,
  requireNotificationOwnerUid,
} from '../functions/src/notifications/contracts';

const validInstallationId = 'a7c8f8b4-b42c-4c5c-9b4e-9f0d1a02c6f2';
const validFid = 'fcm-fid-value-for-device-01';

describe('notification preference contracts', () => {
  it('accepts push-only preferences and ignores a disabled legacy email flag', () => {
    expect(parseNotificationPreferences({ pushEnabled: false })).toEqual({ pushEnabled: false });
    expect(parseNotificationPreferences({ emailEnabled: false, pushEnabled: true })).toEqual({
      pushEnabled: true,
    });
    expect(() =>
      parseNotificationPreferences({ emailEnabled: true, pushEnabled: false }),
    ).toThrow();
    expect(() => parseNotificationPreferences({ pushEnabled: 'yes' })).toThrow();
  });

  it('validates device registration input without changing valid FIDs', () => {
    expect(
      parsePushDeviceRegistration({ installationId: validInstallationId, fid: validFid }),
    ).toEqual({ installationId: validInstallationId, fid: validFid });
    expect(() =>
      parsePushDeviceRegistration({ installationId: 'not-an-id', fid: validFid }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({ installationId: validInstallationId, fid: 'short' }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({ installationId: validInstallationId, fid: `${validFid} ` }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({
        installationId: validInstallationId,
        fid: validFid,
        uid: 'bob',
      }),
    ).toThrow();
  });

  it('accepts an FCM registration token without exposing it through the settings contract', () => {
    const registrationToken = `projects/budgenerator/messages/${'a'.repeat(120)}`;
    expect(
      parsePushDeviceRegistration({ installationId: validInstallationId, registrationToken }),
    ).toEqual({ installationId: validInstallationId, registrationToken });
    expect(() =>
      parsePushDeviceRegistration({ installationId: validInstallationId, registrationToken: '' }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({
        installationId: validInstallationId,
        registrationToken: `${registrationToken}\n`,
      }),
    ).toThrow();
    expect(() =>
      parsePushDeviceRegistration({
        installationId: validInstallationId,
        fid: validFid,
        registrationToken,
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
