import { createHash, randomUUID } from 'node:crypto';
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
const fid = (value: string) => `fid-${value}-abcdefghijklmnop`;

async function createOwner(emailVerified = true) {
  const uid = `notifications-${randomUUID()}`;
  const email = `${uid}@example.test`;
  await auth.createUser({ uid, email, emailVerified });
  owners.push(uid);
  return { uid, email };
}

async function deleteOwnerData(uid: string) {
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
  const indexes = await firestore.collection('pushInstallationIndex').where('uid', '==', uid).get();
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
  it('stores push preferences and clears the retired email settings', async () => {
    const owner = await createOwner(true);
    const preferenceRef = firestore.doc(`users/${owner.uid}/settings/notifications`);
    await preferenceRef.set({
      emailEnabled: true,
      emailEnabledAt: Timestamp.now(),
      pushEnabled: false,
      pushEnabledAt: null,
    });
    await setNotificationPreferences(owner.uid, { pushEnabled: true });
    const activated = await preferenceRef.get();
    expect(activated.get('pushEnabled')).toBe(true);
    expect(activated.get('pushEnabledAt')).toBeInstanceOf(Timestamp);
    expect(activated.get('emailEnabled')).toBeUndefined();
    expect(activated.get('emailEnabledAt')).toBeUndefined();

    await setNotificationPreferences(owner.uid, { pushEnabled: false });
    const deactivated = await preferenceRef.get();
    expect(deactivated.get('pushEnabled')).toBe(false);
    expect(deactivated.get('pushEnabledAt')).toBeNull();
    const settings = await getNotificationSettings(owner.uid);
    expect(settings.preferences).toEqual({ pushEnabled: false });
    expect(settings).not.toHaveProperty('email');
  });

  it('returns device status without returning the stored FCM installation ID', async () => {
    const owner = await createOwner();
    const deviceId = installationId(1);
    const privateFid = fid('private-device');
    await registerPushDevice(owner.uid, { installationId: deviceId, fid: privateFid });

    const settings = await getNotificationSettings(owner.uid);
    expect(settings.devices).toHaveLength(1);
    expect(settings.devices[0]).toMatchObject({ installationId: deviceId, enabled: true });
    expect(settings.devices[0]).not.toHaveProperty('fid');
    expect(JSON.stringify(settings.devices)).not.toContain(privateFid);
    expect(
      (await firestore.doc(`users/${owner.uid}/pushDevices/${deviceId}`).get()).get('fid'),
    ).toBe(privateFid);
  });

  it('stores an FCM registration token privately and indexes it for one device', async () => {
    const owner = await createOwner();
    const deviceId = installationId(3);
    const privateToken = `projects/budgenerator/messages/${'b'.repeat(120)}`;
    await registerPushDevice(owner.uid, { installationId: deviceId, registrationToken: privateToken });

    const deviceRef = firestore.doc(`users/${owner.uid}/pushDevices/${deviceId}`);
    const device = await deviceRef.get();
    const settings = await getNotificationSettings(owner.uid);
    const tokenHash = createHash('sha256').update(privateToken).digest('hex');

    expect(device.get('registrationToken')).toBe(privateToken);
    expect(device.get('fid')).toBeUndefined();
    expect(settings.devices[0]).not.toHaveProperty('registrationToken');
    expect(JSON.stringify(settings.devices)).not.toContain(privateToken);
    expect((await firestore.doc(`pushInstallationIndex/${tokenHash}`).get()).get('uid')).toBe(
      owner.uid,
    );
  });

  it('replaces a legacy FID index when the same device migrates to a registration token', async () => {
    const owner = await createOwner();
    const deviceId = installationId(4);
    const oldFid = fid('legacy-device');
    const registrationToken = `projects/budgenerator/messages/${'c'.repeat(120)}`;
    await registerPushDevice(owner.uid, { installationId: deviceId, fid: oldFid });
    await registerPushDevice(owner.uid, { installationId: deviceId, registrationToken });

    const device = await firestore.doc(`users/${owner.uid}/pushDevices/${deviceId}`).get();
    const oldHash = createHash('sha256').update(oldFid).digest('hex');
    const newHash = createHash('sha256').update(registrationToken).digest('hex');
    expect(device.get('fid')).toBeUndefined();
    expect(device.get('registrationToken')).toBe(registrationToken);
    expect((await firestore.doc(`pushInstallationIndex/${oldHash}`).get()).exists).toBe(false);
    expect((await firestore.doc(`pushInstallationIndex/${newHash}`).get()).get('uid')).toBe(
      owner.uid,
    );
    expect((await firestore.doc(`notificationDeviceCounts/${owner.uid}`).get()).get('count')).toBe(
      1,
    );
  });

  it('caps devices at ten, allows FID refresh for an existing device, and revokes cleanly', async () => {
    const owner = await createOwner();
    for (let index = 1; index <= 10; index++) {
      await registerPushDevice(owner.uid, {
        installationId: installationId(index),
        fid: fid(`device-${index}`),
      });
    }
    await expect(
      registerPushDevice(owner.uid, {
        installationId: installationId(11),
        fid: fid('device-11'),
      }),
    ).rejects.toMatchObject({ code: 'resource-exhausted' });

    const refreshedFid = fid('device-one-refreshed');
    await registerPushDevice(owner.uid, {
      installationId: installationId(1),
      fid: refreshedFid,
    });
    expect((await getNotificationSettings(owner.uid)).devices).toHaveLength(10);
    expect(
      (await firestore.doc(`users/${owner.uid}/pushDevices/${installationId(1)}`).get()).get('fid'),
    ).toBe(refreshedFid);
    expect(await revokePushDevice(owner.uid, installationId(1))).toBe(true);
    expect((await getNotificationSettings(owner.uid)).devices).toHaveLength(9);
    expect((await firestore.doc(`notificationDeviceCounts/${owner.uid}`).get()).get('count')).toBe(
      9,
    );
  });

  it('moves a reused browser FID away from the previous account', async () => {
    const previous = await createOwner();
    const current = await createOwner();
    const sharedFid = fid('same-browser-installation');
    await registerPushDevice(previous.uid, {
      installationId: installationId(20),
      fid: sharedFid,
    });
    await registerPushDevice(current.uid, {
      installationId: installationId(20),
      fid: sharedFid,
    });

    expect((await getNotificationSettings(previous.uid)).devices).toHaveLength(0);
    expect((await getNotificationSettings(current.uid)).devices).toHaveLength(1);
    expect(
      (await firestore.doc(`notificationDeviceCounts/${previous.uid}`).get()).get('count'),
    ).toBe(0);
  });
});
