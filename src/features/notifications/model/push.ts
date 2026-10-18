import { auth, firebaseApp } from '@/shared/firebase/config';
import {
  getNotificationSettings,
  registerPushDevice,
  revokePushDevice,
  setNotificationPreferences,
} from '@/entities/notifications';
import { notificationPathFromLeadId } from './navigation';
import {
  classifyPushAvailability,
  refreshMessagingRegistration,
  type PushAvailability,
  type PushEnvironment,
} from './pushAvailability';

export type { PushAvailability } from './pushAvailability';

const INSTALLATION_KEY = 'budgenerator:notification-installation:v1';
const PENDING_REVOCATIONS_KEY = 'budgenerator:notification-revocations:v1';
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const registrationsInFlight = new Map<string, Set<Promise<void>>>();
const installationsClosing = new Set<string>();

export interface ForegroundLeadNotification {
  jobId: string;
  leadId: string;
  managementPath: string;
}

function browserEnvironment(): Omit<PushEnvironment, 'messagingSupported' | 'serviceWorkerActive'> {
  const notificationAvailable = typeof Notification !== 'undefined';
  return {
    secureContext: typeof isSecureContext === 'undefined' || isSecureContext,
    notificationAvailable,
    serviceWorkerAvailable: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    permission: notificationAvailable ? Notification.permission : null,
    vapidConfigured: typeof VAPID_KEY === 'string' && VAPID_KEY.length > 0,
  };
}

export async function getPushAvailability(): Promise<PushAvailability> {
  const environment = browserEnvironment();
  if (
    !environment.secureContext ||
    !environment.notificationAvailable ||
    !environment.serviceWorkerAvailable
  ) {
    return 'unsupported';
  }
  try {
    const { isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    const registration = await navigator.serviceWorker.getRegistration('/');
    return classifyPushAvailability({
      ...environment,
      messagingSupported: supported,
      serviceWorkerActive: Boolean(registration?.active),
    });
  } catch {
    return 'unsupported';
  }
}

function installationId() {
  try {
    const stored = localStorage.getItem(INSTALLATION_KEY);
    if (
      stored &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)
    )
      return stored;
    const next = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function currentPushInstallationId() {
  try {
    const stored = localStorage.getItem(INSTALLATION_KEY);
    return stored &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)
      ? stored
      : null;
  } catch {
    return null;
  }
}

async function registerInstallationForUser(uid: string, id: string, registrationToken: string) {
  if (auth.currentUser?.uid !== uid || installationsClosing.has(id)) {
    throw new Error('push_owner_changed');
  }
  const pending = registerPushDevice({ installationId: id, registrationToken }).then(
    () => undefined,
  );
  const pendingForInstallation = registrationsInFlight.get(id) ?? new Set<Promise<void>>();
  pendingForInstallation.add(pending);
  registrationsInFlight.set(id, pendingForInstallation);
  try {
    await pending;
  } finally {
    pendingForInstallation.delete(pending);
    if (pendingForInstallation.size === 0) registrationsInFlight.delete(id);
  }
}

async function waitForInstallationRegistrations(id: string) {
  await Promise.allSettled([...(registrationsInFlight.get(id) ?? [])]);
}

export async function activatePushOnThisDevice(refreshStaleRegistration = false) {
  const ownerUid = auth.currentUser?.uid;
  if (!ownerUid) throw new Error('push_owner_changed');
  const environment = browserEnvironment();
  if (
    !environment.secureContext ||
    !environment.notificationAvailable ||
    !environment.serviceWorkerAvailable
  ) {
    throw new Error('push_unsupported');
  }
  if (Notification.permission === 'denied') throw new Error('push_permission_denied');
  if (!VAPID_KEY) throw new Error('push_vapid_unconfigured');

  // This function is called directly by the user gesture. Do not move the
  // browser permission request to an effect or behind unrelated async work.
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('push_permission_denied');
  }

  const messagingApi = await import('firebase/messaging');
  if (!(await messagingApi.isSupported())) throw new Error('push_unsupported');
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) throw new Error('push_service_worker_unavailable');
  const id = installationId();
  if (!id) throw new Error('push_device_storage_unavailable');
  const messaging = messagingApi.getMessaging(firebaseApp);
  if (refreshStaleRegistration) {
    await refreshMessagingRegistration(() => messagingApi.deleteToken(messaging));
  }
  try {
    const registrationToken = await messagingApi.getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!registrationToken) throw new Error('push_registration_token_missing');
    await registerInstallationForUser(ownerUid, id, registrationToken);
  } catch (error) {
    await messagingApi.deleteToken(messaging).catch(() => false);
    throw error;
  }
  return id;
}

export async function enablePushNotifications(
  currentDeviceAlreadyEnabled: boolean,
  refreshStaleRegistration = false,
) {
  const id = await activatePushOnThisDevice(refreshStaleRegistration);
  try {
    await setNotificationPreferences({ pushEnabled: true });
  } catch (error) {
    if (!currentDeviceAlreadyEnabled) await revokePushOnThisDevice().catch(() => undefined);
    throw error;
  }
  return id;
}

async function unregisterCurrentMessagingInstallation() {
  if (
    typeof Notification === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  )
    return;
  try {
    const messagingApi = await import('firebase/messaging');
    if (!(await messagingApi.isSupported())) return;
    await messagingApi.deleteToken(messagingApi.getMessaging(firebaseApp));
  } catch {
    throw new Error('No se ha podido desactivar la suscripción push de este dispositivo.');
  }
}

export async function revokePushOnThisDevice() {
  const id = currentPushInstallationId();
  if (!id) return false;
  installationsClosing.add(id);
  try {
    await waitForInstallationRegistrations(id);
    await revokePushDevice(id);
    await unregisterCurrentMessagingInstallation();
    return true;
  } finally {
    installationsClosing.delete(id);
  }
}

interface PendingRevocation {
  uid: string;
  installationId: string;
}

function readPendingRevocations(): PendingRevocation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_REVOCATIONS_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is PendingRevocation =>
        item &&
        typeof item.uid === 'string' &&
        typeof item.installationId === 'string' &&
        item.installationId.length <= 64,
    );
  } catch {
    return [];
  }
}

function savePendingRevocations(value: PendingRevocation[]) {
  try {
    localStorage.setItem(PENDING_REVOCATIONS_KEY, JSON.stringify(value));
  } catch {
    /* A failed local queue never blocks the account's ordinary navigation. */
  }
}

export async function reconcilePendingPushRevocations(uid: string) {
  const all = readPendingRevocations();
  const pendingForUser = all.filter((item) => item.uid === uid);
  const stillPending = all.filter((item) => item.uid !== uid);
  for (const item of pendingForUser) {
    try {
      await revokePushDevice(item.installationId);
    } catch {
      stillPending.push(item);
    }
  }
  savePendingRevocations(stillPending);
}

export async function revokeCurrentDeviceBeforeSignOut(uid: string) {
  const id = currentPushInstallationId();
  if (!id) return null;
  installationsClosing.add(id);
  await waitForInstallationRegistrations(id);
  let serverRevoked = false;
  try {
    await revokePushDevice(id);
    serverRevoked = true;
  } catch {
    savePendingRevocations([...readPendingRevocations(), { uid, installationId: id }]);
  }
  try {
    await unregisterCurrentMessagingInstallation();
  } catch {
    if (!serverRevoked) {
      installationsClosing.delete(id);
      throw new Error('No se pudo cerrar sesión sin desactivar este dispositivo.');
    }
  }
  return id;
}

export function completeCurrentDeviceSignOut(installationId: string) {
  installationsClosing.delete(installationId);
}

export async function listenForForegroundLeadNotifications(
  listener: (notification: ForegroundLeadNotification) => void,
) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return () => {};
  try {
    const messagingApi = await import('firebase/messaging');
    if (!(await messagingApi.isSupported())) return () => {};
    return messagingApi.onMessage(messagingApi.getMessaging(firebaseApp), (payload) => {
      const jobId = payload.data?.jobId;
      const leadId = payload.data?.leadId;
      const managementPath = notificationPathFromLeadId(leadId);
      if (
        typeof jobId === 'string' &&
        /^[a-f0-9]{64}$/i.test(jobId) &&
        typeof leadId === 'string' &&
        managementPath
      ) {
        listener({ jobId, leadId, managementPath });
      }
    });
  } catch {
    return () => {};
  }
}

export async function synchronizeActivePushInstallation(uid: string) {
  const id = currentPushInstallationId();
  if (
    !id ||
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    !VAPID_KEY ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    auth.currentUser?.uid !== uid
  ) {
    return () => {};
  }
  try {
    const [settings, messagingApi] = await Promise.all([
      getNotificationSettings(),
      import('firebase/messaging'),
    ]);
    if (
      auth.currentUser?.uid !== uid ||
      !settings.devices.some((device) => device.installationId === id && device.enabled) ||
      !(await messagingApi.isSupported())
    ) {
      return () => {};
    }
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration?.active) return () => {};
    const messaging = messagingApi.getMessaging(firebaseApp);
    const registrationToken = await messagingApi.getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (registrationToken && auth.currentUser?.uid === uid) {
      await registerInstallationForUser(uid, id, registrationToken);
    }
    return () => {};
  } catch {
    return () => {};
  }
}

export async function refreshPushOwner(uid: string) {
  await reconcilePendingPushRevocations(uid);
}

export function isCurrentAuthUid(uid: string) {
  return auth.currentUser?.uid === uid;
}
