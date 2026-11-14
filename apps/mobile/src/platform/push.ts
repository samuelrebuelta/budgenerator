import { validLeadId } from '../features/leads/model';

/**
 * Push notifications: extension point only (BG-014 phase 2).
 *
 * TODO(BG-014): implement with `@react-native-firebase/messaging` once the Apple Developer
 * licence (push entitlement, APNs key uploaded to Firebase) and the real Firebase files of
 * `budgenerator` exist (D5, D6). Nothing here is installed or registered yet; `noopPush` is the
 * implementation the app uses. Steps when it is implemented:
 * 1. `requestPermission` after a user action (never on launch), as the web's `PushStartupPrompt`.
 * 2. `getToken` → register the device with the `registerPushDevice` callable of the notifications
 *    repository (`@bg/firebase-api/notifications`), and revoke it (`revokePushDevice`) before
 *    `resetSession` on sign-out (D3).
 * 3. Background/quit taps (`onNotificationOpenedApp`, `getInitialNotification`) and foreground
 *    messages carry `data.leadId` (Functions `notifications/fcm.ts`); open it with
 *    `leadRouteFromPushData`, which validates it with `notifications/navigation` of `@bg/domain`.
 */
export interface PushData {
  [key: string]: string | object | undefined;
}

export interface PushPort {
  /** Whether the platform can receive pushes in this build (false until implemented). */
  readonly available: boolean;
  requestPermission(): Promise<'granted' | 'denied' | 'unavailable'>;
  /** FCM registration token, or `null` when unavailable. */
  getToken(): Promise<string | null>;
  /** Subscribes to taps on a notification; returns the unsubscribe function. */
  onNotificationOpened(listener: (data: PushData) => void): () => void;
  /** Notification that launched the app from a quit state, if any. */
  getInitialNotification(): Promise<PushData | null>;
}

export const noopPush: PushPort = {
  available: false,
  requestPermission: async () => 'unavailable',
  getToken: async () => null,
  onNotificationOpened: () => () => undefined,
  getInitialNotification: async () => null,
};

/** Route of the lead a push points to (`/leads/{leadId}`), or `null` for an unsafe payload. */
export function leadRouteFromPushData(data: PushData | null | undefined) {
  const leadId = validLeadId(data?.leadId);
  return leadId ? (`/leads/${leadId}` as const) : null;
}
