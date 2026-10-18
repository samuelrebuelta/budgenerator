import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg010-notifications',
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'alice'), { uid: 'alice' });
    await setDoc(doc(db, 'users', 'bob'), { uid: 'bob' });
    await setDoc(doc(db, 'users', 'alice', 'settings', 'notifications'), {
      pushEnabled: true,
    });
    await setDoc(doc(db, 'users', 'alice', 'pushDevices', 'device-1'), {
      token: 'private-fcm-token',
      enabled: true,
    });
    await setDoc(doc(db, 'pushTokenIndex', 'token-hash'), {
      uid: 'alice',
      installationId: 'device-1',
    });
    await setDoc(doc(db, 'notificationDeviceCounts', 'alice'), { count: 1 });
    await setDoc(doc(db, 'leadNotificationJobs', 'job-1'), { uid: 'alice', status: 'pending' });
  });
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe('notification Firestore boundary', () => {
  it('lets the owner read preferences but only the server change them', async () => {
    const ownSettings = doc(alice(), 'users', 'alice', 'settings', 'notifications');
    expect((await getDoc(ownSettings)).data()).toMatchObject({
      pushEnabled: true,
    });
    await assertFails(updateDoc(ownSettings, { pushEnabled: false }));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'settings', 'notifications')));
    await assertFails(getDoc(doc(anonymous(), 'users', 'alice', 'settings', 'notifications')));
  });

  it('never exposes device tokens, token indexes, counters or delivery jobs to clients', async () => {
    for (const db of [alice(), bob(), anonymous()]) {
      await assertFails(getDoc(doc(db, 'users', 'alice', 'pushDevices', 'device-1')));
      await assertFails(getDocs(collection(db, 'users', 'alice', 'pushDevices')));
      await assertFails(getDoc(doc(db, 'pushTokenIndex', 'token-hash')));
      await assertFails(getDoc(doc(db, 'notificationDeviceCounts', 'alice')));
      await assertFails(getDoc(doc(db, 'leadNotificationJobs', 'job-1')));
      await assertFails(setDoc(doc(db, 'leadNotificationJobs', 'forged'), { uid: 'alice' }));
    }
  });
});
