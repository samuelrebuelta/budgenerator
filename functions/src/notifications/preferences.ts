import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
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
import { skipPendingNotificationJobs } from './jobs.js';

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

function pushInstallationIndexRef(credentialHash: string) {
  return firestore.doc(`pushInstallationIndex/${credentialHash}`);
}

function deviceCountRef(uid: string) {
  return firestore.doc(`notificationDeviceCounts/${uid}`);
}

function storedPreferences(
  value: FirebaseFirestore.DocumentData | undefined,
): NotificationPreferences {
  return { pushEnabled: value?.pushEnabled === true };
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
    recoveryRequired: value.recoveryRequired === true,
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
  const [preferencesSnapshot, devicesSnapshot] = await Promise.all([
    preferencesRef(uid).get(),
    devicesRef(uid).get(),
  ]);
  const preferences = storedPreferences(preferencesSnapshot.data());
  const devices = devicesSnapshot.docs
    .map((snapshot) => mapSafePushDevice(snapshot.id, snapshot.data()))
    .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''));
  return {
    preferences,
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
    const pushEnabledAt = preferences.pushEnabled
      ? wasEnabled.pushEnabled && current?.pushEnabledAt
        ? current.pushEnabledAt
        : FieldValue.serverTimestamp()
      : null;
    transaction.set(
      ref,
      {
        ...preferences,
        emailEnabled: FieldValue.delete(),
        emailEnabledAt: FieldValue.delete(),
        pushEnabledAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  // Retire work queued by the former email channel before continuing push-only.
  await skipPendingNotificationJobs(uid, 'email');
  if (!preferences.pushEnabled) {
    await skipPendingNotificationJobs(uid, 'push');
  }
  return { preferences };
}

export async function registerPushDevice(uid: string, value: unknown) {
  const registration = parsePushDeviceRegistration(value);
  const { installationId } = registration;
  const credentialType = 'fid' in registration ? 'fid' : 'registrationToken';
  const credential = 'fid' in registration ? registration.fid : registration.registrationToken;
  const credentialHash = createHash('sha256').update(credential).digest('hex');
  const currentDeviceRef = deviceRef(uid, installationId);
  const currentCountRef = deviceCountRef(uid);
  const newIndexRef = pushInstallationIndexRef(credentialHash);
  const displacedDeviceToCancel: { value: { uid: string; installationId: string } | null } = {
    value: null,
  };

  await firestore.runTransaction(async (transaction) => {
    const [newIndexSnapshot, currentDeviceSnapshot, currentCountSnapshot] = await Promise.all([
      transaction.get(newIndexRef),
      transaction.get(currentDeviceRef),
      transaction.get(currentCountRef),
    ]);
    const newIndex = newIndexSnapshot.data() as
      { uid?: unknown; installationId?: unknown } | undefined;
    const displacedDevicePath =
      newIndexSnapshot.exists && !sameDevicePath(uid, installationId, newIndex)
        ? {
            uid: String(newIndex?.uid ?? ''),
            installationId: String(newIndex?.installationId ?? ''),
          }
        : null;
    displacedDeviceToCancel.value = displacedDevicePath;
    const displacedRef = displacedDevicePath
      ? deviceRef(displacedDevicePath.uid, displacedDevicePath.installationId)
      : null;
    const displacedCountRef = displacedDevicePath ? deviceCountRef(displacedDevicePath.uid) : null;
    const [displacedSnapshot, displacedCountSnapshot] =
      displacedRef && displacedCountRef
        ? await Promise.all([transaction.get(displacedRef), transaction.get(displacedCountRef)])
        : [null, null];

    const previousCredentialHash =
      currentDeviceSnapshot.get('fidHash') ?? currentDeviceSnapshot.get('registrationTokenHash');
    const previousIndexRef =
      typeof previousCredentialHash === 'string' && previousCredentialHash !== credentialHash
        ? pushInstallationIndexRef(previousCredentialHash)
        : null;
    const previousIndexSnapshot = previousIndexRef ? await transaction.get(previousIndexRef) : null;
    const previousIndex = previousIndexSnapshot?.data() as
      { uid?: unknown; installationId?: unknown } | undefined;

    const removedFromCurrentUser = Boolean(
      displacedDevicePath &&
      displacedDevicePath.uid === uid &&
      displacedDevicePath.installationId !== installationId &&
      displacedSnapshot?.exists &&
      displacedSnapshot.get('enabled') === true,
    );
    const currentCount = countValue(currentCountSnapshot.data());
    const remainingCount = currentCount - Number(removedFromCurrentUser);
    const currentDeviceEnabled = currentDeviceSnapshot.get('enabled') === true;
    const nextCount = remainingCount + Number(!currentDeviceEnabled);
    if (!canRegisterPushDevice(remainingCount, currentDeviceEnabled)) {
      throw new HttpsError(
        'resource-exhausted',
        'Has alcanzado el máximo de 10 dispositivos con avisos push.',
      );
    }

    if (displacedRef && displacedSnapshot?.exists && displacedDevicePath) {
      transaction.delete(displacedRef);
      if (displacedDevicePath.uid !== uid && displacedCountRef && displacedCountSnapshot) {
        transaction.set(displacedCountRef, {
          count: Math.max(
            0,
            countValue(displacedCountSnapshot.data()) -
              Number(displacedSnapshot.get('enabled') === true),
          ),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    if (
      previousIndexRef &&
      previousIndexSnapshot?.exists &&
      sameDevicePath(uid, installationId, previousIndex)
    ) {
      transaction.delete(previousIndexRef);
    }

    transaction.set(
      currentDeviceRef,
      {
        fid: credentialType === 'fid' ? credential : FieldValue.delete(),
        fidHash: credentialType === 'fid' ? credentialHash : FieldValue.delete(),
        registrationToken:
          credentialType === 'registrationToken' ? credential : FieldValue.delete(),
        registrationTokenHash:
          credentialType === 'registrationToken' ? credentialHash : FieldValue.delete(),
        enabled: true,
        recoveryRequired: false,
        createdAt: currentDeviceSnapshot.get('createdAt') ?? FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(newIndexRef, {
      uid,
      installationId,
      credentialType,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(currentCountRef, { count: nextCount, updatedAt: FieldValue.serverTimestamp() });
  });
  if (displacedDeviceToCancel.value) {
    await skipPendingNotificationJobs(
      displacedDeviceToCancel.value.uid,
      'push',
      displacedDeviceToCancel.value.installationId,
    );
  }
  return { registered: true } as const;
}

export async function revokePushDevice(uid: string, value: unknown) {
  const installationId = parsePushDeviceId(value);
  const ref = deviceRef(uid, installationId);
  const countRef = deviceCountRef(uid);
  const revoked = await firestore.runTransaction(async (transaction) => {
    const [deviceSnapshot, countSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(countRef),
    ]);
    if (!deviceSnapshot.exists) return false;
    const credentialHash =
      deviceSnapshot.get('fidHash') ?? deviceSnapshot.get('registrationTokenHash');
    const indexRef =
      typeof credentialHash === 'string' ? pushInstallationIndexRef(credentialHash) : null;
    const indexSnapshot = indexRef ? await transaction.get(indexRef) : null;
    const index = indexSnapshot?.data() as { uid?: unknown; installationId?: unknown } | undefined;
    if (indexRef && sameDevicePath(uid, installationId, index)) transaction.delete(indexRef);
    transaction.delete(ref);
    transaction.set(countRef, {
      count: Math.max(
        0,
        countValue(countSnapshot.data()) - Number(deviceSnapshot.get('enabled') === true),
      ),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (revoked) await skipPendingNotificationJobs(uid, 'push', installationId);
  return revoked;
}

/** Retire only the credential FCM rejected, preserving an opt-in recovery marker. */
export async function markPushDeviceUnregistered(
  uid: string,
  installationId: string,
  expectedCredential: { fid: string } | { registrationToken: string },
) {
  const ref = deviceRef(uid, installationId);
  const countRef = deviceCountRef(uid);
  const marked = await firestore.runTransaction(async (transaction) => {
    const [deviceSnapshot, countSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(countRef),
    ]);
    const credentialType = 'fid' in expectedCredential ? 'fid' : 'registrationToken';
    const hashField = credentialType === 'fid' ? 'fidHash' : 'registrationTokenHash';
    const credential =
      'fid' in expectedCredential ? expectedCredential.fid : expectedCredential.registrationToken;
    if (
      !deviceSnapshot.exists ||
      deviceSnapshot.get('enabled') !== true ||
      deviceSnapshot.get(credentialType) !== credential
    ) {
      return false;
    }
    const credentialHash = deviceSnapshot.get(hashField);
    const indexRef =
      typeof credentialHash === 'string' ? pushInstallationIndexRef(credentialHash) : null;
    const indexSnapshot = indexRef ? await transaction.get(indexRef) : null;
    const index = indexSnapshot?.data() as { uid?: unknown; installationId?: unknown } | undefined;
    if (indexRef && indexSnapshot?.exists && sameDevicePath(uid, installationId, index)) {
      transaction.delete(indexRef);
    }
    transaction.update(ref, {
      enabled: false,
      recoveryRequired: true,
      fid: FieldValue.delete(),
      fidHash: FieldValue.delete(),
      registrationToken: FieldValue.delete(),
      registrationTokenHash: FieldValue.delete(),
      lastSeenAt: FieldValue.serverTimestamp(),
      unregisteredAt: FieldValue.serverTimestamp(),
    });
    transaction.set(countRef, {
      count: Math.max(0, countValue(countSnapshot.data()) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (marked) await skipPendingNotificationJobs(uid, 'push', installationId);
  return marked;
}

export const notificationFunctionOptions = {
  ...serverFunctionOptions,
  invoker: 'public',
} as const;
