import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type {
  NotificationPreferences,
  NotificationSettingsResponse,
  SafePushDevice,
} from '../../../src/shared/types/notifications.js';
import {
  canRegisterPushDevice,
  parseNotificationPreferences,
  parsePushDeviceId,
  parsePushDeviceRegistration,
} from './contracts.js';

if (getApps().length === 0) initializeApp();
const firestore = getFirestore();
const serverFunctionOptions = {
  region: 'europe-west1',
  maxInstances: 10,
  minInstances: 0,
} as const;

function preferencesRef(uid: string) {
  return firestore.doc(`users/${uid}/settings/notifications`);
}

function devicesRef(uid: string) {
  return firestore.collection(`users/${uid}/pushDevices`);
}

function deviceRef(uid: string, installationId: string) {
  return devicesRef(uid).doc(installationId);
}

function tokenIndexRef(tokenHash: string) {
  return firestore.doc(`pushTokenIndex/${tokenHash}`);
}

function deviceCountRef(uid: string) {
  return firestore.doc(`notificationDeviceCounts/${uid}`);
}

function storedPreferences(
  value: FirebaseFirestore.DocumentData | undefined,
): NotificationPreferences {
  return { emailEnabled: value?.emailEnabled === true, pushEnabled: value?.pushEnabled === true };
}

function timestampToIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function mapSafePushDevice(
  installationId: string,
  value: FirebaseFirestore.DocumentData,
): SafePushDevice {
  return {
    installationId,
    enabled: value.enabled === true,
    createdAt: timestampToIso(value.createdAt),
    lastSeenAt: timestampToIso(value.lastSeenAt),
  };
}

function countValue(value: FirebaseFirestore.DocumentData | undefined) {
  const count = value?.count;
  return Number.isInteger(count) && typeof count === 'number' && count >= 0 ? count : 0;
}

function sameDevicePath(
  uid: string,
  installationId: string,
  candidate: { uid?: unknown; installationId?: unknown } | undefined,
) {
  return candidate?.uid === uid && candidate.installationId === installationId;
}

export async function getNotificationSettings(uid: string): Promise<NotificationSettingsResponse> {
  const [user, preferencesSnapshot, devicesSnapshot] = await Promise.all([
    getAuth().getUser(uid),
    preferencesRef(uid).get(),
    devicesRef(uid).get(),
  ]);
  const preferences = storedPreferences(preferencesSnapshot.data());
  const devices = devicesSnapshot.docs
    .map((snapshot) => mapSafePushDevice(snapshot.id, snapshot.data()))
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''));
  return {
    preferences,
    email: {
      address: typeof user.email === 'string' ? user.email : null,
      verified: user.emailVerified,
    },
    devices,
  };
}

export async function setNotificationPreferences(uid: string, value: unknown) {
  const preferences = parseNotificationPreferences(value);
  const ref = preferencesRef(uid);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const wasEnabled = storedPreferences(current);
    const activationDate = (enabled: boolean, previouslyEnabled: boolean, prior: unknown) => {
      if (!enabled) return null;
      return previouslyEnabled && prior ? prior : FieldValue.serverTimestamp();
    };
    transaction.set(ref, {
      ...preferences,
      emailEnabledAt: activationDate(
        preferences.emailEnabled,
        wasEnabled.emailEnabled,
        current?.emailEnabledAt,
      ),
      pushEnabledAt: activationDate(
        preferences.pushEnabled,
        wasEnabled.pushEnabled,
        current?.pushEnabledAt,
      ),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { preferences };
}

export async function registerPushDevice(uid: string, value: unknown) {
  const { installationId, token } = parsePushDeviceRegistration(value);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const currentDeviceRef = deviceRef(uid, installationId);
  const currentCountRef = deviceCountRef(uid);
  const newTokenIndexRef = tokenIndexRef(tokenHash);

  await firestore.runTransaction(async (transaction) => {
    const [newTokenIndexSnapshot, currentDeviceSnapshot, currentCountSnapshot] = await Promise.all([
      transaction.get(newTokenIndexRef),
      transaction.get(currentDeviceRef),
      transaction.get(currentCountRef),
    ]);
    const newTokenIndex = newTokenIndexSnapshot.data() as
      { uid?: unknown; installationId?: unknown } | undefined;
    const displacedDevicePath =
      newTokenIndexSnapshot.exists && !sameDevicePath(uid, installationId, newTokenIndex)
        ? {
            uid: String(newTokenIndex?.uid ?? ''),
            installationId: String(newTokenIndex?.installationId ?? ''),
          }
        : null;
    const displacedRef = displacedDevicePath
      ? deviceRef(displacedDevicePath.uid, displacedDevicePath.installationId)
      : null;
    const displacedCountRef = displacedDevicePath ? deviceCountRef(displacedDevicePath.uid) : null;
    const [displacedSnapshot, displacedCountSnapshot] =
      displacedRef && displacedCountRef
        ? await Promise.all([transaction.get(displacedRef), transaction.get(displacedCountRef)])
        : [null, null];

    const previousTokenHash = currentDeviceSnapshot.get('tokenHash');
    const previousTokenIndexRef =
      typeof previousTokenHash === 'string' && previousTokenHash !== tokenHash
        ? tokenIndexRef(previousTokenHash)
        : null;
    const previousTokenIndexSnapshot = previousTokenIndexRef
      ? await transaction.get(previousTokenIndexRef)
      : null;
    const previousTokenIndex = previousTokenIndexSnapshot?.data() as
      { uid?: unknown; installationId?: unknown } | undefined;

    const removedFromCurrentUser = Boolean(
      displacedDevicePath &&
      displacedDevicePath.uid === uid &&
      displacedDevicePath.installationId !== installationId &&
      displacedSnapshot?.exists,
    );
    const currentCount = countValue(currentCountSnapshot.data());
    const remainingCount = currentCount - Number(removedFromCurrentUser);
    const nextCount = remainingCount + Number(!currentDeviceSnapshot.exists);
    if (!canRegisterPushDevice(remainingCount, currentDeviceSnapshot.exists)) {
      throw new HttpsError(
        'resource-exhausted',
        'Has alcanzado el máximo de 10 dispositivos con avisos push.',
      );
    }

    if (displacedRef && displacedSnapshot?.exists && displacedDevicePath) {
      transaction.delete(displacedRef);
      if (displacedDevicePath.uid !== uid && displacedCountRef && displacedCountSnapshot) {
        transaction.set(displacedCountRef, {
          count: Math.max(0, countValue(displacedCountSnapshot.data()) - 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    if (
      previousTokenIndexRef &&
      previousTokenIndexSnapshot?.exists &&
      sameDevicePath(uid, installationId, previousTokenIndex)
    ) {
      transaction.delete(previousTokenIndexRef);
    }

    transaction.set(currentDeviceRef, {
      token,
      tokenHash,
      enabled: true,
      createdAt: currentDeviceSnapshot.get('createdAt') ?? FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    });
    transaction.set(newTokenIndexRef, {
      uid,
      installationId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(currentCountRef, { count: nextCount, updatedAt: FieldValue.serverTimestamp() });
  });
  return { registered: true } as const;
}

export async function revokePushDevice(uid: string, value: unknown) {
  const installationId = parsePushDeviceId(value);
  const ref = deviceRef(uid, installationId);
  const countRef = deviceCountRef(uid);
  return firestore.runTransaction(async (transaction) => {
    const [deviceSnapshot, countSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(countRef),
    ]);
    if (!deviceSnapshot.exists) return false;
    const tokenHash = deviceSnapshot.get('tokenHash');
    const indexRef = typeof tokenHash === 'string' ? tokenIndexRef(tokenHash) : null;
    const indexSnapshot = indexRef ? await transaction.get(indexRef) : null;
    const index = indexSnapshot?.data() as { uid?: unknown; installationId?: unknown } | undefined;
    if (indexRef && sameDevicePath(uid, installationId, index)) transaction.delete(indexRef);
    transaction.delete(ref);
    transaction.set(countRef, {
      count: Math.max(0, countValue(countSnapshot.data()) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export const notificationFunctionOptions = {
  ...serverFunctionOptions,
  invoker: 'public',
} as const;
