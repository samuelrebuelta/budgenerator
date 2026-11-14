import { createNotificationsRepository } from '@bg/firebase-api/notifications';
import { webFunctions } from '@/shared/firebase/functions';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

/** Web binding of the shared notification callables (`@bg/firebase-api`, BG-014 D2). */
const repository = createNotificationsRepository({
  functions: webFunctions,
  guardMutation: guardNetworkMutation,
});

export const {
  getNotificationSettings,
  setNotificationPreferences,
  registerPushDevice,
  revokePushDevice,
} = repository;
