import { Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { consumeRateLimits } from '../abuse/rateLimit.js';
import { runtimeConfig, scheduleOptions, triggerOptions } from '../core/config.js';
import { logEvent, observe, pseudonym } from '../core/observability.js';
import { cleanupInactivePushDevices } from '../retention/retention.js';
import { sendPushNotification } from './fcm.js';
import { enqueueLeadNotifications } from './jobs.js';
import {
  cleanupExpiredNotificationJobs,
  NOTIFICATION_JOB_HORIZON_MS,
  processNotificationJob,
  recoverNotificationJobs,
} from './worker.js';

const HOUR_MS = 3_600_000;

const serverNotificationTransport = {
  sendPush: sendPushNotification,
};

/** Retried events older than the job horizon can no longer produce a useful push. */
export function isStaleLeadEvent(eventTime: string | undefined, nowMs = Date.now()) {
  const eventMs = eventTime ? Date.parse(eventTime) : Number.NaN;
  return Number.isFinite(eventMs) && nowMs - eventMs > NOTIFICATION_JOB_HORIZON_MS;
}

/**
 * At most `LIMIT_LEAD_PUSH_PER_OWNER_PER_HOUR` pushes per owner and hour, so a
 * burst of junk leads does not flood the owner's devices. The leads are still
 * stored and visible in the app; only the extra pushes are skipped.
 */
export async function allowLeadPush(uid: string, nowMs = Date.now()) {
  const exceeded = await consumeRateLimits(
    [
      {
        scope: 'lead_push_owner',
        subject: uid,
        limit: runtimeConfig.limits.leadPushPerOwnerPerHour,
        windowMs: HOUR_MS,
      },
    ],
    nowMs,
  );
  return exceeded === null;
}

export const processNewLeadNotifications = onDocumentCreated(
  {
    ...triggerOptions,
    document: 'users/{uid}/leads/{leadId}',
    retry: true,
  },
  (event) =>
    observe('processNewLeadNotifications', async () => {
      const { uid, leadId } = event.params;
      if (isStaleLeadEvent(event.time)) {
        logEvent('warn', 'lead_event_discarded', { reason: 'stale', subject: pseudonym(uid) });
        return;
      }
      if (!(await allowLeadPush(uid))) {
        logEvent('warn', 'lead_push_throttled', { subject: pseudonym(uid) });
        return;
      }
      const eventTime = event.time ? Timestamp.fromDate(new Date(event.time)) : Timestamp.now();
      const jobIds = await enqueueLeadNotifications({ uid, leadId, eventTime });
      await Promise.all(
        jobIds.map((jobId) => processNotificationJob(jobId, serverNotificationTransport)),
      );
    }),
);

export const recoverLeadNotificationJobs = onSchedule(
  {
    ...scheduleOptions,
    schedule: 'every 5 minutes',
    timeoutSeconds: 240,
  },
  () =>
    observe('recoverLeadNotificationJobs', async () => {
      const processed = await recoverNotificationJobs(serverNotificationTransport);
      if (processed > 0) logEvent('info', 'notification_jobs_recovered', { processed });
    }),
);

export const cleanupLeadNotificationJobs = onSchedule(
  {
    ...scheduleOptions,
    schedule: 'every day 03:15',
  },
  () =>
    observe('cleanupLeadNotificationJobs', async () => {
      const deleted = await cleanupExpiredNotificationJobs();
      logEvent('info', 'notification_jobs_cleaned', { deleted });
    }),
);

export const cleanupPushDevices = onSchedule(
  {
    ...scheduleOptions,
    schedule: 'every monday 04:00',
  },
  () =>
    observe('cleanupPushDevices', async () => {
      await cleanupInactivePushDevices();
    }),
);
