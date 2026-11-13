import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { runtimeConfig } from '../core/config.js';
import { firestore } from '../core/firebase.js';
import { logEvent } from '../core/observability.js';
import { RATE_LIMIT_COLLECTION } from '../abuse/rateLimit.js';
import { revokePushDevice } from '../notifications/preferences.js';

const DAY_MS = 86_400_000;
const PAGE = 300;
/** Upper bound per run so one invocation stays well under its timeout. */
const MAX_PAGES = 20;

async function deleteMatching(query: FirebaseFirestore.Query) {
  let deleted = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const snapshot = await query.limit(PAGE).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < PAGE) break;
  }
  return deleted;
}

/** `YYYY-MM` of a lead's receipt: the only date kept after anonymizing it. */
export function receivedMonth(createdAt: unknown) {
  const date = createdAt instanceof Timestamp ? createdAt.toDate() : null;
  return date ? date.toISOString().slice(0, 7) : null;
}

/**
 * Fields removed from a lead once it is older than the retention period: contact data, consent
 * timestamp and the request fingerprint (derived from the contact). Removing `createdAt` also
 * takes the lead out of the retention query, so each lead is processed once.
 */
export function anonymizedLeadUpdate(createdAt: unknown) {
  return {
    contact: FieldValue.delete(),
    consentAt: FieldValue.delete(),
    requestHash: FieldValue.delete(),
    createdAt: FieldValue.delete(),
    receivedMonth: receivedMonth(createdAt),
    anonymizedAt: FieldValue.serverTimestamp(),
  };
}

async function anonymizeMatching(query: FirebaseFirestore.Query) {
  let anonymized = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const snapshot = await query.limit(PAGE).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    for (const document of snapshot.docs)
      batch.update(document.ref, anonymizedLeadUpdate(document.get('createdAt')));
    await batch.commit();
    anonymized += snapshot.size;
    if (snapshot.size < PAGE) break;
  }
  return anonymized;
}

export function leadRetentionCutoff(nowMs: number, months = runtimeConfig.leadRetentionMonths) {
  const cutoff = new Date(nowMs);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return Timestamp.fromDate(cutoff);
}

/**
 * Daily data retention:
 * - leads older than `LEAD_RETENTION_MONTHS` (default 12) are anonymized: the contact data is
 *   removed and only the requested work, the estimate and the month of receipt are kept;
 * - public budget snapshots whose numeric `expiresAt` has passed are deleted;
 * - expired abuse counters and legacy per-token counters are deleted
 *   (backup for the TTL policy on `abuseRateLimits.expiresAt`).
 */
export async function applyDataRetention(nowMs = Date.now()) {
  const leadsAnonymized = await anonymizeMatching(
    firestore
      .collectionGroup('leads')
      .where('createdAt', '<', leadRetentionCutoff(nowMs))
      .orderBy('createdAt'),
  );
  const sharedBudgets = await deleteMatching(
    firestore.collection('sharedBudgets').where('expiresAt', '<', nowMs).orderBy('expiresAt'),
  );
  const rateLimits = await deleteMatching(
    firestore
      .collection(RATE_LIMIT_COLLECTION)
      .where('expiresAt', '<', Timestamp.fromMillis(nowMs))
      .orderBy('expiresAt'),
  );
  const staleCounterCutoff = Timestamp.fromMillis(nowMs - 2 * DAY_MS);
  let legacyRateLimits = 0;
  for (const collection of ['quoteEstimateRateLimits', 'quoteLeadRateLimits'])
    legacyRateLimits += await deleteMatching(
      firestore
        .collection(collection)
        .where('updatedAt', '<', staleCounterCutoff)
        .orderBy('updatedAt'),
    );
  const result = { leadsAnonymized, sharedBudgets, rateLimits, legacyRateLimits };
  logEvent('info', 'retention_applied', result);
  return result;
}

function deviceOwner(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  return snapshot.ref.parent.parent?.id ?? null;
}

/**
 * Removes push devices that FCM will no longer deliver to: no activity for
 * `PUSH_DEVICE_INACTIVE_DAYS` (FCM drops tokens after ~270 days) or waiting for
 * a new token (`recoveryRequired`) for `PUSH_DEVICE_RECOVERY_DAYS`. Uses the
 * same revocation path as the user, so index, counter and queued jobs stay
 * consistent.
 */
export async function cleanupInactivePushDevices(nowMs = Date.now()) {
  const inactiveCutoff = Timestamp.fromMillis(
    nowMs - runtimeConfig.pushDeviceInactiveDays * DAY_MS,
  );
  const recoveryCutoff = Timestamp.fromMillis(
    nowMs - runtimeConfig.pushDeviceRecoveryDays * DAY_MS,
  );
  const [inactive, unrecovered] = await Promise.all([
    firestore
      .collectionGroup('pushDevices')
      .where('lastSeenAt', '<', inactiveCutoff)
      .limit(500)
      .get(),
    firestore
      .collectionGroup('pushDevices')
      .where('unregisteredAt', '<', recoveryCutoff)
      .limit(500)
      .get(),
  ]);
  const candidates = new Map<string, { uid: string; installationId: string }>();
  for (const snapshot of inactive.docs) {
    const uid = deviceOwner(snapshot);
    if (uid) candidates.set(snapshot.ref.path, { uid, installationId: snapshot.id });
  }
  for (const snapshot of unrecovered.docs) {
    const uid = deviceOwner(snapshot);
    if (uid && snapshot.get('enabled') !== true)
      candidates.set(snapshot.ref.path, { uid, installationId: snapshot.id });
  }
  let removed = 0;
  let failed = 0;
  for (const { uid, installationId } of candidates.values()) {
    try {
      if (await revokePushDevice(uid, installationId)) removed += 1;
    } catch {
      failed += 1;
    }
  }
  logEvent(failed ? 'warn' : 'info', 'push_devices_cleaned', { removed, failed });
  return { removed, failed };
}
