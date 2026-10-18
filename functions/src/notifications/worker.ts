import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { markPushDeviceUnregistered } from './preferences.js';
import { NotificationDeliveryError, type NotificationTransport } from './delivery.js';
import {
  type NotificationChannel,
  type NotificationJob,
  type NotificationJobStatus,
} from './jobs.js';

if (getApps().length === 0) initializeApp();
const firestore = getFirestore();

export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const NOTIFICATION_JOB_HORIZON_MS = 6 * 60 * 60 * 1000;
export const NOTIFICATION_JOB_RETENTION_MS = 30 * 86400000;
const LEASE_DURATION_MS = 60_000;
const MAX_RECOVERY_BATCH = 50;
const MAX_CLEANUP_BATCH = 400;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 60 * 60 * 1000;

export { NotificationDeliveryError } from './delivery.js';
export type { NotificationTransport } from './delivery.js';

/** A fail-closed adapter until a provider is selected and explicitly configured. */
export const unconfiguredNotificationTransport: NotificationTransport = {
  async sendPush() {
    throw new NotificationDeliveryError('push_transport_unconfigured', false);
  },
};

function jobsRef() {
  return firestore.collection('leadNotificationJobs');
}

function jobRef(jobId: string) {
  return jobsRef().doc(jobId);
}

function leadRef(uid: string, leadId: string) {
  return firestore.doc(`users/${uid}/leads/${leadId}`);
}

function preferencesRef(uid: string) {
  return firestore.doc(`users/${uid}/settings/notifications`);
}

function deviceRef(uid: string, installationId: string) {
  return firestore.doc(`users/${uid}/pushDevices/${installationId}`);
}

function asTimestamp(value: unknown) {
  return value instanceof Timestamp ? value : null;
}

function asJobStatus(value: unknown): NotificationJobStatus | null {
  return value === 'pending' ||
    value === 'processing' ||
    value === 'sent' ||
    value === 'retryable' ||
    value === 'failed' ||
    value === 'skipped'
    ? value
    : null;
}

export function calculateRetryDelayMs(attempt: number, jitter = Math.random()) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_NOTIFICATION_ATTEMPTS) {
    throw new RangeError(
      `Notification attempts must be between 1 and ${MAX_NOTIFICATION_ATTEMPTS}.`,
    );
  }
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    throw new RangeError('Notification retry jitter must be between 0 and 1.');
  }
  const exponentialDelay = RETRY_BASE_MS * 2 ** (attempt - 1);
  return Math.min(RETRY_MAX_MS, Math.round(exponentialDelay * (1 + jitter * 0.2)));
}

function clearLease() {
  return {
    leaseId: FieldValue.delete(),
    leaseExpiresAt: FieldValue.delete(),
  };
}

async function finishIfOwned(
  jobId: string,
  leaseId: string,
  update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
) {
  const reference = jobRef(jobId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (
      !snapshot.exists ||
      snapshot.get('status') !== 'processing' ||
      snapshot.get('leaseId') !== leaseId
    )
      return false;
    transaction.update(reference, { ...update, ...clearLease() });
    return true;
  });
}

type ClaimedJob = { job: NotificationJob; leaseId: string };

async function claimNotificationJob(jobId: string, nowMs: number): Promise<ClaimedJob | null> {
  const reference = jobRef(jobId);
  const leaseId = randomUUID();
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    const status = asJobStatus(data.status);
    if (!status || status === 'sent' || status === 'failed' || status === 'skipped') return null;

    const attempts = Number.isInteger(data.attempts) && data.attempts >= 0 ? data.attempts : 0;
    const createdAt = asTimestamp(data.createdAt) ?? asTimestamp(data.eventTime);
    const nextAttemptAt = asTimestamp(data.nextAttemptAt);
    const leaseExpiresAt = asTimestamp(data.leaseExpiresAt);
    const leaseExpired =
      status === 'processing' && (!leaseExpiresAt || leaseExpiresAt.toMillis() <= nowMs);
    const due =
      status === 'processing' ? leaseExpired : !nextAttemptAt || nextAttemptAt.toMillis() <= nowMs;
    if (!due) return null;

    // Email delivery was removed. Skip legacy email jobs before applying push
    // retry limits so old records cannot accumulate as failed notifications.
    if (data.channel === 'email') {
      transaction.update(reference, {
        status: 'skipped',
        skippedReason: 'channel_removed',
        ...clearLease(),
      });
      return null;
    }

    if (
      !createdAt ||
      nowMs - createdAt.toMillis() >= NOTIFICATION_JOB_HORIZON_MS ||
      attempts >= MAX_NOTIFICATION_ATTEMPTS
    ) {
      transaction.update(reference, {
        status: 'failed',
        failureCode:
          attempts >= MAX_NOTIFICATION_ATTEMPTS ? 'attempt_limit_reached' : 'job_expired',
        ...clearLease(),
      });
      return null;
    }

    const leaseJob: NotificationJob = {
      uid: typeof data.uid === 'string' ? data.uid : '',
      leadId: typeof data.leadId === 'string' ? data.leadId : '',
      channel: data.channel === 'push' ? 'push' : 'email',
      ...(typeof data.installationId === 'string' ? { installationId: data.installationId } : {}),
      status: 'processing',
      attempts: attempts + 1,
      createdAt,
      eventTime: asTimestamp(data.eventTime) ?? createdAt,
      nextAttemptAt: nextAttemptAt ?? Timestamp.fromMillis(0),
      leaseId,
      leaseExpiresAt: Timestamp.fromMillis(nowMs + LEASE_DURATION_MS),
    };
    transaction.update(reference, {
      status: 'processing',
      attempts: attempts + 1,
      leaseId,
      leaseExpiresAt: leaseJob.leaseExpiresAt,
      lastAttemptAt: Timestamp.fromMillis(nowMs),
    });
    return { job: leaseJob, leaseId };
  });
}

async function skipOwnedJob(jobId: string, leaseId: string, reason: string) {
  await finishIfOwned(jobId, leaseId, { status: 'skipped', skippedReason: reason });
}

async function deliverClaimedJob(
  jobId: string,
  { job, leaseId }: ClaimedJob,
  transport: NotificationTransport,
  now: () => number,
) {
  try {
    if (job.channel === 'email') {
      await skipOwnedJob(jobId, leaseId, 'channel_removed');
      return true;
    }
    const [leadSnapshot, preferenceSnapshot] = await Promise.all([
      leadRef(job.uid, job.leadId).get(),
      preferencesRef(job.uid).get(),
    ]);
    if (!leadSnapshot.exists) {
      await skipOwnedJob(jobId, leaseId, 'lead_missing');
      return true;
    }

    try {
      await getAuth().getUser(job.uid);
    } catch (error) {
      if ((error as { code?: unknown })?.code === 'auth/user-not-found') {
        await skipOwnedJob(jobId, leaseId, 'owner_missing');
        return true;
      }
      throw error;
    }

    const leadCreatedAt = asTimestamp(leadSnapshot.get('createdAt')) ?? job.eventTime;
    const preferences = preferenceSnapshot.data();
    const channelEnabled =
      preferences?.pushEnabled === true &&
      asTimestamp(preferences?.pushEnabledAt)?.toMillis() !== undefined &&
      (asTimestamp(preferences?.pushEnabledAt)?.toMillis() ?? Number.POSITIVE_INFINITY) <=
        leadCreatedAt.toMillis();
    if (!channelEnabled) {
      await skipOwnedJob(jobId, leaseId, 'channel_disabled');
      return true;
    }

    if (!job.installationId) {
      await skipOwnedJob(jobId, leaseId, 'device_missing');
      return true;
    }
    const deviceSnapshot = await deviceRef(job.uid, job.installationId).get();
    if (!deviceSnapshot.exists || deviceSnapshot.get('enabled') !== true) {
      await skipOwnedJob(jobId, leaseId, 'device_revoked');
      return true;
    }
    const fid = deviceSnapshot.get('fid');
    const registrationToken = deviceSnapshot.get('registrationToken');
    const pushTarget =
      typeof registrationToken === 'string'
        ? { registrationToken }
        : typeof fid === 'string'
          ? { fid }
          : null;
    const deviceCreatedAt = asTimestamp(deviceSnapshot.get('createdAt'));
    if (!pushTarget || !deviceCreatedAt || deviceCreatedAt.toMillis() > leadCreatedAt.toMillis()) {
      await skipOwnedJob(jobId, leaseId, 'device_unavailable');
      return true;
    }
    let result: { messageId: string };
    try {
      result = await transport.sendPush({ jobId, leadId: job.leadId, ...pushTarget });
    } catch (error) {
      const invalidCode =
        'registrationToken' in pushTarget ? 'push_registration_token_invalid' : 'push_fid_invalid';
      if (error instanceof NotificationDeliveryError && error.code === invalidCode) {
        await markPushDeviceUnregistered(job.uid, job.installationId, pushTarget);
        await skipOwnedJob(jobId, leaseId, 'device_unregistered');
        return true;
      }
      throw error;
    }
    await finishIfOwned(jobId, leaseId, {
      status: 'sent',
      providerMessageId: result.messageId,
      sentAt: Timestamp.fromMillis(now()),
    });
    return true;
  } catch (error) {
    const attempt = job.attempts;
    const deliveryError =
      error instanceof NotificationDeliveryError
        ? error
        : new NotificationDeliveryError('delivery_unavailable', true);
    if (!deliveryError.retryable || attempt >= MAX_NOTIFICATION_ATTEMPTS) {
      await finishIfOwned(jobId, leaseId, {
        status: 'failed',
        failureCode:
          attempt >= MAX_NOTIFICATION_ATTEMPTS ? 'attempt_limit_reached' : deliveryError.code,
        failedAt: Timestamp.fromMillis(now()),
      });
      return true;
    }

    const delay = calculateRetryDelayMs(attempt);
    const nextAttemptAt = now() + delay;
    const ageStart = job.createdAt.toMillis();
    if (nextAttemptAt - ageStart >= NOTIFICATION_JOB_HORIZON_MS) {
      await finishIfOwned(jobId, leaseId, {
        status: 'failed',
        failureCode: 'job_expired',
        failedAt: Timestamp.fromMillis(now()),
      });
      return true;
    }
    await finishIfOwned(jobId, leaseId, {
      status: 'retryable',
      failureCode: deliveryError.code,
      nextAttemptAt: Timestamp.fromMillis(nextAttemptAt),
    });
    return true;
  }
}

export async function processNotificationJob(
  jobId: string,
  transport: NotificationTransport = unconfiguredNotificationTransport,
  now: () => number = Date.now,
) {
  const claim = await claimNotificationJob(jobId, now());
  if (!claim) return false;
  return deliverClaimedJob(jobId, claim, transport, now);
}

async function recoverableJobIds(now: Timestamp) {
  const [pending, retryable, processing] = await Promise.all([
    jobsRef()
      .where('status', '==', 'pending')
      .where('nextAttemptAt', '<=', now)
      .orderBy('nextAttemptAt')
      .limit(MAX_RECOVERY_BATCH)
      .get(),
    jobsRef()
      .where('status', '==', 'retryable')
      .where('nextAttemptAt', '<=', now)
      .orderBy('nextAttemptAt')
      .limit(MAX_RECOVERY_BATCH)
      .get(),
    jobsRef()
      .where('status', '==', 'processing')
      .where('leaseExpiresAt', '<=', now)
      .orderBy('leaseExpiresAt')
      .limit(MAX_RECOVERY_BATCH)
      .get(),
  ]);
  return [...pending.docs, ...retryable.docs, ...processing.docs].map((snapshot) => snapshot.id);
}

export async function recoverNotificationJobs(
  transport: NotificationTransport = unconfiguredNotificationTransport,
  now: () => number = Date.now,
) {
  const ids = await recoverableJobIds(Timestamp.fromMillis(now()));
  const results = await Promise.all(ids.map((id) => processNotificationJob(id, transport, now)));
  return results.filter(Boolean).length;
}

export async function cleanupExpiredNotificationJobs(now: () => number = Date.now) {
  const cutoff = Timestamp.fromMillis(now() - NOTIFICATION_JOB_RETENTION_MS);
  const expired = await jobsRef()
    .where('createdAt', '<', cutoff)
    .orderBy('createdAt')
    .limit(MAX_CLEANUP_BATCH)
    .get();
  if (expired.empty) return 0;
  const batch = firestore.batch();
  for (const document of expired.docs) batch.delete(document.ref);
  await batch.commit();
  return expired.size;
}

export function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'email' || value === 'push';
}
