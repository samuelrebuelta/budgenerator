import { describe, expect, it, vi } from 'vitest';
import * as pushAvailability from '../src/features/notifications/model/pushAvailability';
import type { PushAvailability } from '../src/features/notifications/model/pushAvailability';

const getStartupPushPrompt = (
  pushAvailability as unknown as {
    getStartupPushPrompt?: (
      availability: PushAvailability | 'checking',
      pushEnabled: boolean,
      currentDeviceEnabled: boolean,
      dismissed: boolean,
    ) => 'none' | 'activate' | 'blocked';
  }
).getStartupPushPrompt;

const shouldRecoverInvalidPushDevice = (
  pushAvailability as unknown as {
    shouldRecoverInvalidPushDevice?: (
      availability: PushAvailability | 'checking',
      pushEnabled: boolean,
      recoveryRequired: boolean,
    ) => boolean;
  }
).shouldRecoverInvalidPushDevice;

const shouldRefreshStalePushRegistration = (
  pushAvailability as unknown as {
    shouldRefreshStalePushRegistration?: (
      pushEnabled: boolean,
      currentDeviceEnabled: boolean,
      recoveryRequired: boolean,
    ) => boolean;
  }
).shouldRefreshStalePushRegistration;

const refreshMessagingRegistration = (
  pushAvailability as unknown as {
    refreshMessagingRegistration?: (deleteRegistration: () => Promise<unknown>) => Promise<void>;
  }
).refreshMessagingRegistration;

const supportedEnvironment = {
  secureContext: true,
  notificationAvailable: true,
  serviceWorkerAvailable: true,
  messagingSupported: true,
  permission: 'granted' as NotificationPermission,
  serviceWorkerActive: true,
  vapidConfigured: true,
};

describe('push activation capability', () => {
  it('recovers an FCM-invalid device only while account preference and browser permission remain active', () => {
    expect(shouldRecoverInvalidPushDevice).toBeTypeOf('function');
    expect(shouldRecoverInvalidPushDevice?.('ready', true, true)).toBe(true);
    expect(shouldRecoverInvalidPushDevice?.('ready', false, true)).toBe(false);
    expect(shouldRecoverInvalidPushDevice?.('ready', true, false)).toBe(false);
    expect(shouldRecoverInvalidPushDevice?.('permission-required', true, true)).toBe(false);
    expect(shouldRecoverInvalidPushDevice?.('permission-blocked', true, true)).toBe(false);
  });

  it('forces a fresh FCM registration for an enabled preference with no live device', () => {
    expect(shouldRefreshStalePushRegistration).toBeTypeOf('function');
    expect(shouldRefreshStalePushRegistration?.(true, false, false)).toBe(true);
    expect(shouldRefreshStalePushRegistration?.(true, false, true)).toBe(true);
    expect(shouldRefreshStalePushRegistration?.(true, true, false)).toBe(false);
    expect(shouldRefreshStalePushRegistration?.(false, false, true)).toBe(true);
    expect(shouldRefreshStalePushRegistration?.(false, false, false)).toBe(false);
  });

  it('continues to request a fresh registration when deleting a stale token fails', async () => {
    expect(refreshMessagingRegistration).toBeTypeOf('function');
    const deleteRegistration = vi.fn().mockRejectedValue(new Error('Token is already invalid'));

    await expect(refreshMessagingRegistration?.(deleteRegistration)).resolves.toBeUndefined();

    expect(deleteRegistration).toHaveBeenCalledOnce();
  });

  it('deletes the existing registration before requesting a new token', async () => {
    expect(refreshMessagingRegistration).toBeTypeOf('function');
    const deleteRegistration = vi.fn().mockResolvedValue(true);

    await refreshMessagingRegistration?.(deleteRegistration);

    expect(deleteRegistration).toHaveBeenCalledOnce();
  });

  it('offers an in-app activation prompt without invoking the system prompt on mount', () => {
    expect(getStartupPushPrompt).toBeTypeOf('function');
    expect(getStartupPushPrompt?.('permission-required', false, false, false)).toBe('activate');
    expect(getStartupPushPrompt?.('ready', true, false, false)).toBe('activate');
  });

  it('shows recovery guidance after denial and hides redundant startup prompts', () => {
    expect(getStartupPushPrompt?.('permission-blocked', false, false, false)).toBe('blocked');
    expect(getStartupPushPrompt?.('ready', true, true, false)).toBe('none');
    expect(getStartupPushPrompt?.('permission-required', false, false, true)).toBe('none');
    expect(getStartupPushPrompt?.('checking', false, false, false)).toBe('none');
  });

  it('distinguishes unsupported browsers, blocked permission, and missing setup', () => {
    expect(
      pushAvailability.classifyPushAvailability({ ...supportedEnvironment, secureContext: false }),
    ).toBe('unsupported');
    expect(
      pushAvailability.classifyPushAvailability({ ...supportedEnvironment, permission: 'denied' }),
    ).toBe('permission-blocked');
    expect(
      pushAvailability.classifyPushAvailability({
        ...supportedEnvironment,
        serviceWorkerActive: false,
      }),
    ).toBe('service-worker-unavailable');
    expect(
      pushAvailability.classifyPushAvailability({
        ...supportedEnvironment,
        vapidConfigured: false,
      }),
    ).toBe('vapid-unconfigured');
  });

  it('only describes push as ready after permission and service worker are active', () => {
    expect(
      pushAvailability.classifyPushAvailability({ ...supportedEnvironment, permission: 'default' }),
    ).toBe('permission-required');
    expect(pushAvailability.classifyPushAvailability(supportedEnvironment)).toBe('ready');
  });
});
