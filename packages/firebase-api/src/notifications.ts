import type { NotificationPreferences, NotificationSettingsResponse } from '@bg/domain/types';
import type { FunctionsPort } from './functionsPort.js';
import { runGuarded, unguardedMutation, type MutationGuard } from './firestorePort.js';

export interface NotificationsRepositoryOptions {
  functions: FunctionsPort;
  guardMutation?: MutationGuard;
}

export interface PushDeviceInput {
  installationId: string;
  registrationToken: string;
  /** The PWA always registers as web; native apps send ios or android. */
  platform: 'web' | 'ios' | 'android';
}

/** Notification callables (BG-010) shared by the PWA and the native apps. */
export function createNotificationsRepository({
  functions,
  guardMutation = unguardedMutation,
}: NotificationsRepositoryOptions) {
  async function getNotificationSettings() {
    const call = functions.httpsCallable<void, NotificationSettingsResponse>(
      'getNotificationSettings',
    );
    return (await call()).data;
  }

  async function setNotificationPreferences(preferences: NotificationPreferences) {
    const call = functions.httpsCallable<
      NotificationPreferences,
      { preferences: NotificationPreferences }
    >('setNotificationPreferences');
    return runGuarded(guardMutation, async () => (await call(preferences)).data);
  }

  async function registerPushDevice(input: PushDeviceInput) {
    const call = functions.httpsCallable<PushDeviceInput, { registered: true }>(
      'registerPushDevice',
    );
    return (await call(input)).data;
  }

  async function revokePushDevice(installationId: string) {
    const call = functions.httpsCallable<{ installationId: string }, { revoked: boolean }>(
      'revokePushDevice',
    );
    return runGuarded(guardMutation, async () => (await call({ installationId })).data);
  }

  return {
    getNotificationSettings,
    setNotificationPreferences,
    registerPushDevice,
    revokePushDevice,
  };
}

export type NotificationsRepository = ReturnType<typeof createNotificationsRepository>;
