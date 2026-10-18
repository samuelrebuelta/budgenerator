import { Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendPushNotification } from './fcm.js';
import { enqueueLeadNotifications } from './jobs.js';
import {
  cleanupExpiredNotificationJobs,
  processNotificationJob,
  recoverNotificationJobs,
} from './worker.js';

const functionOptions = {
  region: 'europe-west1',
  maxInstances: 10,
  minInstances: 0,
} as const;

const serverNotificationTransport = {
  sendPush: sendPushNotification,
};

export const processNewLeadNotifications = onDocumentCreated(
  {
    ...functionOptions,
    document: 'users/{uid}/leads/{leadId}',
    retry: true,
  },
  async (event) => {
    const { uid, leadId } = event.params;
    const eventTime = event.time ? Timestamp.fromDate(new Date(event.time)) : Timestamp.now();
    const jobIds = await enqueueLeadNotifications({ uid, leadId, eventTime });
    await Promise.all(
      jobIds.map((jobId) => processNotificationJob(jobId, serverNotificationTransport)),
    );
  },
);

export const recoverLeadNotificationJobs = onSchedule(
  {
    ...functionOptions,
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    maxInstances: 1,
  },
  async () => {
    await recoverNotificationJobs(serverNotificationTransport);
  },
);

export const cleanupLeadNotificationJobs = onSchedule(
  {
    ...functionOptions,
    schedule: 'every day 03:15',
    timeZone: 'UTC',
    maxInstances: 1,
  },
  async () => {
    await cleanupExpiredNotificationJobs();
  },
);
