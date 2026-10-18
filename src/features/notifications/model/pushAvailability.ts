export type PushAvailability =
  | 'ready'
  | 'permission-required'
  | 'permission-blocked'
  | 'service-worker-unavailable'
  | 'vapid-unconfigured'
  | 'unsupported';

export interface PushEnvironment {
  secureContext: boolean;
  notificationAvailable: boolean;
  serviceWorkerAvailable: boolean;
  messagingSupported: boolean;
  permission: NotificationPermission | null;
  serviceWorkerActive: boolean;
  vapidConfigured: boolean;
}

export type StartupPushPrompt = 'none' | 'activate' | 'blocked';

export function shouldRecoverInvalidPushDevice(
  availability: PushAvailability | 'checking',
  pushEnabled: boolean,
  recoveryRequired: boolean,
) {
  return availability === 'ready' && pushEnabled && recoveryRequired;
}

export function shouldRefreshStalePushRegistration(
  pushEnabled: boolean,
  currentDeviceEnabled: boolean,
  recoveryRequired: boolean,
) {
  return recoveryRequired || (pushEnabled && !currentDeviceEnabled);
}

export async function refreshMessagingRegistration(deleteRegistration: () => Promise<unknown>) {
  try {
    await deleteRegistration();
  } catch {
    // The cached FCM registration may already be invalid; continue to request a fresh token.
  }
}

export function getStartupPushPrompt(
  availability: PushAvailability | 'checking',
  pushEnabled: boolean,
  currentDeviceEnabled: boolean,
  dismissed: boolean,
): StartupPushPrompt {
  if (dismissed) return 'none';
  if (availability === 'permission-blocked') return 'blocked';
  if (
    availability === 'permission-required' ||
    (availability === 'ready' && (!pushEnabled || !currentDeviceEnabled))
  ) {
    return 'activate';
  }
  return 'none';
}

export function classifyPushAvailability(environment: PushEnvironment): PushAvailability {
  if (
    !environment.secureContext ||
    !environment.notificationAvailable ||
    !environment.serviceWorkerAvailable ||
    !environment.messagingSupported
  ) {
    return 'unsupported';
  }
  if (environment.permission === 'denied') return 'permission-blocked';
  if (!environment.vapidConfigured) return 'vapid-unconfigured';
  if (!environment.serviceWorkerActive) return 'service-worker-unavailable';
  if (environment.permission !== 'granted') return 'permission-required';
  return 'ready';
}
