import { httpsCallable } from 'firebase/functions';
import type { NotificationPreferences, NotificationSettingsResponse } from '@/shared/types';
import { functions } from '@/shared/firebase/config';
import { runNetworkMutation } from '@/shared/lib/networkMutation';

export async function getNotificationSettings() {
  const call = httpsCallable<void, NotificationSettingsResponse>(
    functions,
    'getNotificationSettings',
  );
  return (await call()).data;
}

export async function setNotificationPreferences(preferences: NotificationPreferences) {
  const call = httpsCallable<NotificationPreferences, { preferences: NotificationPreferences }>(
    functions,
    'setNotificationPreferences',
  );
  return runNetworkMutation(async () => (await call(preferences)).data);
}

export async function registerPushDevice(input: {
  installationId: string;
  registrationToken: string;
  /** The PWA always registers as web; native apps send ios or android. */
  platform: 'web' | 'ios' | 'android';
}) {
  const call = httpsCallable<typeof input, { registered: true }>(functions, 'registerPushDevice');
  return (await call(input)).data;
}

export async function revokePushDevice(installationId: string) {
  const call = httpsCallable<{ installationId: string }, { revoked: boolean }>(
    functions,
    'revokePushDevice',
  );
  return runNetworkMutation(async () => (await call({ installationId })).data);
}
