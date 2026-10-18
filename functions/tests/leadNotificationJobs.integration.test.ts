import { randomUUID, createHash } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import {
  getNotificationSettings,
  setNotificationPreferences,
  registerPushDevice,
} from '../src/notifications/preferences';
import { enqueueLeadNotifications } from '../src/notifications/jobs';
import {
  cleanupExpiredNotificationJobs,
  NotificationDeliveryError,
  processNotificationJob,
  recoverNotificationJobs,
} from '../src/notifications/worker';

const auth = getAuth();
const firestore = getFirestore();
const owners: string[] = [];
const installationId = '00000000-0000-4000-8000-000000000001';
const fid = 'fcm-fid-test-device-abcdefghijklmnop';

async function createOwner() {
  const uid = `notification-jobs-${randomUUID()}`;
  await auth.createUser({ uid });
  owners.push(uid);
  return uid;
}

async function createLead(uid: string, leadId: string, createdAt: Timestamp) {
  await firestore.doc(`users/${uid}/leads/${leadId}`).set({
    schemaVersion: 2,
    contact: {
      name: 'Nombre privado',
      email: 'lead-contact@example.test',
      phone: '+34 600 000 000',
    },
    createdAt,
    consentAt: createdAt,
    privacyPolicyUrl: 'https://example.test/privacy',
  });
}

async function jobsFor(uid: string, leadId?: string) {
  let query = firestore.collection('leadNotificationJobs').where('uid', '==', uid);
  if (leadId) query = query.where('leadId', '==', leadId);
  const snapshot = await query.get();
  return snapshot.docs;
}

async function deleteOwnerData(uid: string) {
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
  const [jobs, indexes] = await Promise.all([
    firestore.collection('leadNotificationJobs').where('uid', '==', uid).get(),
    firestore.collection('pushInstallationIndex').where('uid', '==', uid).get(),
  ]);
  const batch = firestore.batch();
  for (const item of jobs.docs) batch.delete(item.ref);
  for (const item of indexes.docs) batch.delete(item.ref);
  batch.delete(firestore.doc(`notificationDeviceCounts/${uid}`));
  await batch.commit();
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Notification job integration tests require Auth and Firestore emulators.');
});

beforeEach(() => {
  owners.length = 0;
});

afterEach(async () => {
  for (const uid of owners) {
    await deleteOwnerData(uid);
    await auth.deleteUser(uid).catch(() => undefined);
  }
  owners.length = 0;
});

describe('durable push notification jobs', () => {
  it('creates one push job per device under duplicate events and ignores legacy email settings', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await firestore.doc(`users/${uid}/settings/notifications`).set(
      {
        emailEnabled: true,
        emailEnabledAt: Timestamp.now(),
      },
      { merge: true },
    );
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const input = { uid, leadId, eventTime: createdAt };

    const results = await Promise.all([
      enqueueLeadNotifications(input),
      enqueueLeadNotifications(input),
      enqueueLeadNotifications(input),
    ]);
    const jobs = await jobsFor(uid, leadId);

    expect(new Set(results.flat())).toHaveProperty('size', 1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.get('channel')).toBe('push');
    expect(jobs[0]?.get('installationId')).toBe(installationId);
    expect(JSON.stringify(jobs.map((job) => job.data()))).not.toContain(fid);
    expect(JSON.stringify(jobs.map((job) => job.data()))).not.toContain('Nombre privado');
  });

  it('skips queued email jobs from the retired channel without an email transport', async () => {
    const uid = await createOwner();
    const jobId = createHash('sha256').update(randomUUID()).digest('hex');
    await firestore.doc(`leadNotificationJobs/${jobId}`).set({
      uid,
      leadId: randomUUID(),
      channel: 'email',
      status: 'pending',
      attempts: 0,
      createdAt: Timestamp.now(),
      eventTime: Timestamp.now(),
      nextAttemptAt: Timestamp.fromMillis(0),
    });
    const transport = { sendPush: async () => ({ messageId: 'unused' }) };

    await processNotificationJob(jobId, transport);

    const job = await firestore.doc(`leadNotificationJobs/${jobId}`).get();
    expect(job.get('status')).toBe('skipped');
    expect(job.get('skippedReason')).toBe('channel_removed');
  });

  it('retries transient push delivery under the same job identity, then records acceptance', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    const deliveryIds: string[] = [];
    const transport = {
      sendPush: async (input: { jobId: string; leadId: string; fid: string }) => {
        deliveryIds.push(input.jobId);
        expect(input.leadId).toBe(leadId);
        expect(input.fid).toBe(fid);
        expect(JSON.stringify(input)).not.toContain('lead-contact@example.test');
        if (deliveryIds.length === 1)
          throw new NotificationDeliveryError('temporary_failure', true);
        return { messageId: 'fake-provider-accepted' };
      },
    };

    await processNotificationJob(jobId, transport);
    expect((await firestore.doc(`leadNotificationJobs/${jobId}`).get()).get('status')).toBe(
      'retryable',
    );
    await processNotificationJob(jobId, transport);
    expect(deliveryIds).toEqual([jobId]);

    await firestore.doc(`leadNotificationJobs/${jobId}`).update({
      nextAttemptAt: Timestamp.fromMillis(0),
    });
    await processNotificationJob(jobId, transport);
    const completed = await firestore.doc(`leadNotificationJobs/${jobId}`).get();
    expect(completed.get('status')).toBe('sent');
    expect(completed.get('attempts')).toBe(2);
    expect(completed.get('providerMessageId')).toBe('fake-provider-accepted');
    expect(deliveryIds).toEqual([jobId, jobId]);
  });

  it('cancels a retry when push is disabled and skips a deleted lead', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    let attempts = 0;
    const transport = {
      sendPush: async () => {
        attempts += 1;
        throw new NotificationDeliveryError('temporary_failure', true);
      },
    };
    await processNotificationJob(jobId, transport);
    await setNotificationPreferences(uid, { pushEnabled: false });
    expect((await firestore.doc(`leadNotificationJobs/${jobId}`).get()).get('status')).toBe(
      'skipped',
    );
    await processNotificationJob(jobId, transport);
    expect(attempts).toBe(1);

    await setNotificationPreferences(uid, { pushEnabled: true });
    const deletedLeadId = randomUUID();
    const deletedCreatedAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, deletedLeadId, deletedCreatedAt);
    const [deletedJobId] = await enqueueLeadNotifications({
      uid,
      leadId: deletedLeadId,
      eventTime: deletedCreatedAt,
    });
    await firestore.doc(`users/${uid}/leads/${deletedLeadId}`).delete();
    await processNotificationJob(deletedJobId, transport);
    expect((await firestore.doc(`leadNotificationJobs/${deletedJobId}`).get()).get('status')).toBe(
      'skipped',
    );
    expect(attempts).toBe(1);
  });

  it('skips a queued push when its owner has been deleted', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    await auth.deleteUser(uid);

    await processNotificationJob(jobId, { sendPush: async () => ({ messageId: 'must-not-send' }) });

    const job = await firestore.doc(`leadNotificationJobs/${jobId}`).get();
    expect(job.get('status')).toBe('skipped');
    expect(job.get('skippedReason')).toBe('owner_missing');
  });

  it('marks an unregistered FID for recovery without retaining its credentials', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });

    await processNotificationJob(jobId, {
      sendPush: async () => {
        throw new NotificationDeliveryError('push_fid_invalid', false);
      },
    });

    expect((await firestore.doc(`leadNotificationJobs/${jobId}`).get()).get('status')).toBe(
      'skipped',
    );
    const device = await firestore.doc(`users/${uid}/pushDevices/${installationId}`).get();
    expect(device.exists).toBe(true);
    expect(device.get('enabled')).toBe(false);
    expect(device.get('recoveryRequired')).toBe(true);
    expect(device.get('fid')).toBeUndefined();
    expect(device.get('fidHash')).toBeUndefined();
    expect((await firestore.doc(`notificationDeviceCounts/${uid}`).get()).get('count')).toBe(0);
    expect((await getNotificationSettings(uid)).devices[0]?.recoveryRequired).toBe(true);
    const fidHash = createHash('sha256').update(fid).digest('hex');
    expect((await firestore.doc(`pushInstallationIndex/${fidHash}`).get()).exists).toBe(false);

    const replacementFid = 'fcm-fid-test-device-recovery-123456';
    await registerPushDevice(uid, { installationId, fid: replacementFid });
    const recovered = await firestore.doc(`users/${uid}/pushDevices/${installationId}`).get();
    expect(recovered.get('enabled')).toBe(true);
    expect(recovered.get('recoveryRequired')).toBe(false);
    expect(recovered.get('fid')).toBe(replacementFid);
    expect((await firestore.doc(`notificationDeviceCounts/${uid}`).get()).get('count')).toBe(1);
  });

  it('delivers with a registration token and retires it if FCM says it is unregistered', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    const registrationToken = `projects/budgenerator/messages/${'d'.repeat(120)}`;
    await registerPushDevice(uid, { installationId, registrationToken });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    const tokenHash = createHash('sha256').update(registrationToken).digest('hex');
    let deliveredToken: string | undefined;

    await processNotificationJob(jobId, {
      sendPush: async (input: { jobId: string; leadId: string; registrationToken: string }) => {
        deliveredToken = input.registrationToken;
        throw new NotificationDeliveryError('push_registration_token_invalid', false);
      },
    });

    const job = await firestore.doc(`leadNotificationJobs/${jobId}`).get();
    const device = await firestore.doc(`users/${uid}/pushDevices/${installationId}`).get();
    expect(deliveredToken).toBe(registrationToken);
    expect(job.get('status')).toBe('skipped');
    expect(job.get('skippedReason')).toBe('device_unregistered');
    expect(device.get('enabled')).toBe(false);
    expect(device.get('recoveryRequired')).toBe(true);
    expect(device.get('registrationToken')).toBeUndefined();
    expect(device.get('registrationTokenHash')).toBeUndefined();
    expect((await firestore.doc(`pushInstallationIndex/${tokenHash}`).get()).exists).toBe(false);
    expect((await firestore.doc(`notificationDeviceCounts/${uid}`).get()).get('count')).toBe(0);
  });

  it('does not mark a replacement FID as invalid when an old delivery fails late', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    const replacementFid = 'fcm-fid-test-device-replacement-123456';

    await processNotificationJob(jobId, {
      sendPush: async () => {
        await registerPushDevice(uid, { installationId, fid: replacementFid });
        throw new NotificationDeliveryError('push_fid_invalid', false);
      },
    });

    const device = await firestore.doc(`users/${uid}/pushDevices/${installationId}`).get();
    expect(device.get('enabled')).toBe(true);
    expect(device.get('recoveryRequired')).toBe(false);
    expect(device.get('fid')).toBe(replacementFid);
  });

  it('recovers an expired lease, fails expired jobs and cleans jobs after 30 days', async () => {
    const uid = await createOwner();
    await setNotificationPreferences(uid, { pushEnabled: true });
    await registerPushDevice(uid, { installationId, fid });
    const leadId = randomUUID();
    const createdAt = Timestamp.fromMillis(Date.now() + 60_000);
    await createLead(uid, leadId, createdAt);
    const [jobId] = await enqueueLeadNotifications({ uid, leadId, eventTime: createdAt });
    await firestore.doc(`leadNotificationJobs/${jobId}`).update({
      status: 'processing',
      attempts: 1,
      leaseId: 'expired-lease',
      leaseExpiresAt: Timestamp.fromMillis(Date.now() - 60_000),
    });
    const transport = { sendPush: async () => ({ messageId: 'recovered-send' }) };
    expect(await recoverNotificationJobs(transport)).toBe(1);
    expect((await firestore.doc(`leadNotificationJobs/${jobId}`).get()).get('status')).toBe('sent');

    const staleRef = firestore.doc('leadNotificationJobs/stale-pending-job');
    await staleRef.set({
      uid,
      leadId,
      channel: 'push',
      installationId,
      status: 'pending',
      attempts: 0,
      createdAt: Timestamp.fromMillis(Date.now() - 7 * 60 * 60 * 1000),
      eventTime: Timestamp.fromMillis(Date.now() - 7 * 60 * 60 * 1000),
      nextAttemptAt: Timestamp.fromMillis(0),
    });
    expect(await recoverNotificationJobs(transport)).toBe(0);
    expect((await staleRef.get()).get('status')).toBe('failed');
    expect((await staleRef.get()).get('failureCode')).toBe('job_expired');

    const oldRef = firestore.doc('leadNotificationJobs/old-retained-job');
    const recentRef = firestore.doc('leadNotificationJobs/recent-job');
    await oldRef.set({ uid, createdAt: Timestamp.fromMillis(Date.now() - 31 * 86400000) });
    await recentRef.set({ uid, createdAt: Timestamp.now() });
    expect(await cleanupExpiredNotificationJobs()).toBe(1);
    expect((await oldRef.get()).exists).toBe(false);
    expect((await recentRef.get()).exists).toBe(true);
    await staleRef.delete();
    await recentRef.delete();
  });
});
