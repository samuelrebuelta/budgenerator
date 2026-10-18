import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  getNotificationSettings,
  registerPushDevice,
  revokePushDevice,
  setNotificationPreferences,
} from '../src/notifications/preferences';

const auth = getAuth();
const firestore = getFirestore();
const owners: string[] = [];
const installationId = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
const token = (value: string) => `fcm-token-${value}-abcdefghijklmnopqrstuvwxyz`;

async function createOwner(emailVerified = true) {
  const uid = `notifications-${randomUUID()}`;
  const email = `${uid}@example.test`;
  await auth.createUser({ uid, email, emailVerified });
  owners.push(uid);
  return { uid, email };
}

async function deleteOwnerData(uid: string) {
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
  const indexes = await firestore.collection('pushTokenIndex').where('uid', '==', uid).get();
  const batch = firestore.batch();
  for (const item of indexes.docs) batch.delete(item.ref);
  batch.delete(firestore.doc(`notificationDeviceCounts/${uid}`));
  await batch.commit();
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error(
      'Notification preference integration tests require Auth and Firestore emulators.',
    );
});

beforeEach(() => {
  owners.length = 0;
});

afterEach(async () => {
  for (const uid of owners) {
    await deleteOwnerData(uid);
    await auth.deleteUser(uid);
  }
  owners.length = 0;
});

describe('notification preferences and private push devices', () => {
  it('changes email and push preferences independently and reads verified Auth email', async () => {
    const owner = await createOwner(true);
    const preferenceRef = firestore.doc(`users/${owner.uid}/settings/notifications`);
    await setNotificationPreferences(owner.uid, { emailEnabled: true, pushEnabled: false });
    const firstActivation = (await preferenceRef.get()).get('emailEnabledAt');
    expect(firstActivation).toBeInstanceOf(Timestamp);

    await setNotificationPreferences(owner.uid, { emailEnabled: true, pushEnabled: true });
    const afterPushActivation = await preferenceRef.get();
    expect(afterPushActivation.get('emailEnabledAt').toMillis()).toBe(firstActivation.toMillis());
    expect(afterPushActivation.get('pushEnabledAt')).toBeInstanceOf(Timestamp);

    await setNotificationPreferences(owner.uid, { emailEnabled: false, pushEnabled: true });
    const afterEmailDisable = await preferenceRef.get();
    expect(afterEmailDisable.get('emailEnabledAt')).toBeNull();
    expect(afterEmailDisable.get('pushEnabledAt').toMillis()).toBe(
      afterPushActivation.get('pushEnabledAt').toMillis(),
    );
    const disabledSettings = await getNotificationSettings(owner.uid);
    expect(disabledSettings.preferences).toMatchObject({ emailEnabled: false, pushEnabled: true });

    await setNotificationPreferences(owner.uid, { emailEnabled: true, pushEnabled: true });
    expect((await preferenceRef.get()).get('emailEnabledAt')).toBeInstanceOf(Timestamp);

    const settings = await getNotificationSettings(owner.uid);
    expect(settings.preferences).toMatchObject({ emailEnabled: true, pushEnabled: true });
    expect(settings.email).toEqual({ address: owner.email, verified: true });
  });

  it('returns device status without returning the stored FCM token', async () => {
    const owner = await createOwner();
    const deviceId = installationId(1);
    const privateToken = token('private-device');
    await registerPushDevice(owner.uid, { installationId: deviceId, token: privateToken });

    const settings = await getNotificationSettings(owner.uid);
    expect(settings.devices).toHaveLength(1);
    expect(settings.devices[0]).toMatchObject({ installationId: deviceId, enabled: true });
    expect(settings.devices[0]).not.toHaveProperty('token');
    expect(JSON.stringify(settings.devices)).not.toContain(privateToken);
    expect(
      (await firestore.doc(`users/${owner.uid}/pushDevices/${deviceId}`).get()).get('token'),
    ).toBe(privateToken);
  });

  it('caps devices at ten, allows token refresh for an existing device, and revokes cleanly', async () => {
    const owner = await createOwner();
    for (let index = 1; index <= 10; index++) {
      await registerPushDevice(owner.uid, {
        installationId: installationId(index),
        token: token(`device-${index}`),
      });
    }
    await expect(
      registerPushDevice(owner.uid, {
        installationId: installationId(11),
        token: token('device-11'),
      }),
    ).rejects.toMatchObject({ code: 'resource-exhausted' });

    const refreshedToken = token('device-one-refreshed');
    await registerPushDevice(owner.uid, {
      installationId: installationId(1),
      token: refreshedToken,
    });
    expect((await getNotificationSettings(owner.uid)).devices).toHaveLength(10);
    expect(
      (await firestore.doc(`users/${owner.uid}/pushDevices/${installationId(1)}`).get()).get(
        'token',
      ),
    ).toBe(refreshedToken);
    expect(await revokePushDevice(owner.uid, installationId(1))).toBe(true);
    expect((await getNotificationSettings(owner.uid)).devices).toHaveLength(9);
    expect((await firestore.doc(`notificationDeviceCounts/${owner.uid}`).get()).get('count')).toBe(
      9,
    );
  });

  it('moves a reused browser token away from the previous account', async () => {
    const previous = await createOwner();
    const current = await createOwner();
    const sharedToken = token('same-browser-installation');
    await registerPushDevice(previous.uid, {
      installationId: installationId(20),
      token: sharedToken,
    });
    await registerPushDevice(current.uid, {
      installationId: installationId(20),
      token: sharedToken,
    });

    expect((await getNotificationSettings(previous.uid)).devices).toHaveLength(0);
    expect((await getNotificationSettings(current.uid)).devices).toHaveLength(1);
    expect(
      (await firestore.doc(`notificationDeviceCounts/${previous.uid}`).get()).get('count'),
    ).toBe(0);
  });
});
