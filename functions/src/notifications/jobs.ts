import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();
const firestore = getFirestore();

// `email` remains readable only to retire jobs from the previous channel.
export type NotificationChannel = 'email' | 'push';
export type NotificationJobStatus =
  'pending' | 'processing' | 'sent' | 'retryable' | 'failed' | 'skipped';

export interface NotificationJobIdentity {
  uid: string;
  leadId: string;
  channel: NotificationChannel;
  installationId?: string;
}

export interface EnqueueLeadNotificationsInput {
  uid: string;
  leadId: string;
  eventTime: Timestamp;
}

export interface NotificationJob {
  uid: string;
  leadId: string;
  channel: NotificationChannel;
  installationId?: string;
  status: NotificationJobStatus;
  attempts: number;
  createdAt: FirebaseFirestore.Timestamp;
  eventTime: FirebaseFirestore.Timestamp;
  nextAttemptAt: FirebaseFirestore.Timestamp;
  leaseId?: string;
  leaseExpiresAt?: FirebaseFirestore.Timestamp;
}

export function createNotificationJobId(identity: NotificationJobIdentity) {
  return createHash('sha256')
    .update(
      [identity.uid, identity.leadId, identity.channel, identity.installationId ?? ''].join('\0'),
    )
    .digest('hex');
}

function timestampMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isEnabledForLead(enabled: boolean, enabledAt: unknown, leadCreatedAt: unknown) {
  const activationMillis = timestampMillis(enabledAt);
  const leadCreatedMillis = timestampMillis(leadCreatedAt);
  return (
    enabled &&
    activationMillis !== null &&
    leadCreatedMillis !== null &&
    activationMillis <= leadCreatedMillis
  );
}

function notificationSettingsRef(uid: string) {
  return firestore.doc(`users/${uid}/settings/notifications`);
}

function leadRef(uid: string, leadId: string) {
  return firestore.doc(`users/${uid}/leads/${leadId}`);
}

function pushDevicesRef(uid: string) {
  return firestore.collection(`users/${uid}/pushDevices`);
}

function jobsRef() {
  return firestore.collection('leadNotificationJobs');
}

function asTimestamp(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

export async function enqueueLeadNotifications({
  uid,
  leadId,
  eventTime,
}: EnqueueLeadNotificationsInput): Promise<string[]> {
  const [leadSnapshot, preferencesSnapshot, devicesSnapshot] = await Promise.all([
    leadRef(uid, leadId).get(),
    notificationSettingsRef(uid).get(),
    pushDevicesRef(uid).get(),
  ]);
  if (!leadSnapshot.exists) return [];

  const leadCreatedAt = asTimestamp(leadSnapshot.get('createdAt')) ?? eventTime;
  const preferences = preferencesSnapshot.data();
  const jobs: NotificationJobIdentity[] = [];

  if (
    isEnabledForLead(preferences?.pushEnabled === true, preferences?.pushEnabledAt, leadCreatedAt)
  ) {
    for (const device of devicesSnapshot.docs) {
      const value = device.data();
      if (
        value.enabled === true &&
        (typeof value.registrationToken === 'string' || typeof value.fid === 'string') &&
        isEnabledForLead(true, value.createdAt, leadCreatedAt)
      ) {
        jobs.push({ uid, leadId, channel: 'push', installationId: device.id });
      }
    }
  }

  if (jobs.length === 0) return [];

  const queuedAt = Timestamp.now();
  const jobIds = jobs.map(createNotificationJobId);
  const batch = firestore.batch();
  jobs.forEach((identity, index) => {
    const jobId = jobIds[index];
    if (!jobId) return;
    batch.create(jobsRef().doc(jobId), {
      ...identity,
      status: 'pending' satisfies NotificationJobStatus,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      eventTime: leadCreatedAt,
      nextAttemptAt: queuedAt,
      retentionExpiresAt: Timestamp.fromMillis(queuedAt.toMillis() + 30 * 86400000),
    });
  });
  try {
    await batch.commit();
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    // The deterministic IDs and atomic create batch make an already-existing
    // delivery an idempotent success, including a retried Firestore event.
    if (code !== 6 && code !== '6' && code !== 'already-exists') throw error;
  }
  return jobIds;
}

export async function skipPendingNotificationJobs(
  uid: string,
  channel: NotificationChannel,
  installationId?: string,
) {
  let query: FirebaseFirestore.Query = jobsRef()
    .where('uid', '==', uid)
    .where('channel', '==', channel)
    .where('status', 'in', ['pending', 'retryable']);
  if (channel === 'push' && installationId)
    query = query.where('installationId', '==', installationId);

  const jobs = await query.limit(200).get();
  if (jobs.empty) return 0;
  const batch = firestore.batch();
  for (const job of jobs.docs)
    batch.update(job.ref, { status: 'skipped', skippedReason: 'disabled' });
  await batch.commit();
  return jobs.size;
}
