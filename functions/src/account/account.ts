import {
  DocumentReference,
  GeoPoint,
  Timestamp,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { adminAuth, firestore } from '../core/firebase.js';
import { logEvent, pseudonym } from '../core/observability.js';
import { SHORT_LINK_COLLECTION } from '../quoteEstimator.js';
import {
  PRIVACY_NOTICE_COLLECTION,
  PRIVACY_NOTICE_OWNER_COLLECTION,
  findOwnerPrivacyNotice,
} from '../privacyNotice.js';

const BATCH_LIMIT = 400;

/** Fields never exported: push credentials and their hashes are server secrets. */
const PRIVATE_DEVICE_FIELDS = new Set([
  'fid',
  'fidHash',
  'registrationToken',
  'registrationTokenHash',
]);

async function deleteQuery(query: FirebaseFirestore.Query) {
  let deleted = 0;
  for (;;) {
    const page = await query.limit(BATCH_LIMIT).get();
    if (page.empty) return deleted;
    const batch = firestore.batch();
    for (const document of page.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += page.size;
    if (page.size < BATCH_LIMIT) return deleted;
  }
}

async function deleteEstimatorTokens(uid: string) {
  const tokens = await firestore.collection('publicQuoteTokens').where('ownerUid', '==', uid).get();
  const link = await firestore.doc(`quoteEstimatorLinks/${uid}`).get();
  const linkedToken = link.get('token');
  const tokenIds = new Set(tokens.docs.map((document) => document.id));
  if (typeof linkedToken === 'string') tokenIds.add(linkedToken);
  const writer = firestore.bulkWriter();
  for (const token of tokenIds) {
    void writer.delete(firestore.doc(`publicQuoteTokens/${token}`));
    void writer.delete(firestore.doc(`quoteEstimateRateLimits/${token}`));
    void writer.delete(firestore.doc(`quoteLeadRateLimits/${token}`));
  }
  void writer.delete(link.ref);
  await writer.close();
  return tokenIds.size;
}

/** Short link and hosted privacy notice: public documents created for the estimator. */
async function deleteEstimatorSharing(uid: string) {
  const slugs = await deleteQuery(
    firestore.collection(SHORT_LINK_COLLECTION).where('ownerUid', '==', uid),
  );
  const noticeId = await findOwnerPrivacyNotice(uid);
  if (noticeId) await firestore.doc(`${PRIVACY_NOTICE_COLLECTION}/${noticeId}`).delete();
  await firestore.doc(`${PRIVACY_NOTICE_OWNER_COLLECTION}/${uid}`).delete();
  return { slugs, privacyNotice: Boolean(noticeId) };
}

export interface DeleteAccountResult {
  deleted: true;
  authUserDeleted: boolean;
}

/**
 * Deletes every document that belongs to `uid` and finally the Auth user.
 * Idempotent: each step tolerates missing data, so a retry after a partial
 * failure completes the job. Auth is deleted last so the user can retry.
 */
export async function deleteAccountData(uid: string): Promise<DeleteAccountResult> {
  const subject = pseudonym(uid);
  const tokens = await deleteEstimatorTokens(uid);
  const sharing = await deleteEstimatorSharing(uid);
  const sharedBudgets = await deleteQuery(
    firestore.collection('sharedBudgets').where('ownerUid', '==', uid),
  );
  const pushIndexes = await deleteQuery(
    firestore.collection('pushInstallationIndex').where('uid', '==', uid),
  );
  const jobs = await deleteQuery(
    firestore.collection('leadNotificationJobs').where('uid', '==', uid),
  );
  await firestore.doc(`notificationDeviceCounts/${uid}`).delete();
  await firestore.recursiveDelete(firestore.doc(`users/${uid}`));

  let authUserDeleted = false;
  try {
    await adminAuth().deleteUser(uid);
    authUserDeleted = true;
  } catch (error) {
    if ((error as { code?: unknown })?.code !== 'auth/user-not-found') throw error;
  }
  logEvent('info', 'account_deleted', {
    subject,
    tokens,
    ...sharing,
    sharedBudgets,
    pushIndexes,
    jobs,
    authUserDeleted,
  });
  return { deleted: true, authUserDeleted };
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof DocumentReference) return value.path;
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object') {
    const result: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) result[key] = toJson(item);
    return result;
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
    return value;
  return String(value);
}

function exportedDocument(snapshot: DocumentSnapshot) {
  const data = { ...(snapshot.data() ?? {}) };
  if (snapshot.ref.parent.id === 'pushDevices')
    for (const field of PRIVATE_DEVICE_FIELDS) delete data[field];
  return { path: snapshot.ref.path, data: toJson(data) };
}

async function collectTree(
  reference: DocumentReference,
  output: ReturnType<typeof exportedDocument>[],
) {
  const snapshot = await reference.get();
  if (snapshot.exists) output.push(exportedDocument(snapshot));
  for (const collection of await reference.listCollections()) {
    for (const child of await collection.listDocuments()) await collectTree(child, output);
  }
}

/** Right of access (art. 15 RGPD): every document of the account as JSON. */
export async function exportAccountData(uid: string) {
  const documents: ReturnType<typeof exportedDocument>[] = [];
  await collectTree(firestore.doc(`users/${uid}`), documents);
  const shared = await firestore.collection('sharedBudgets').where('ownerUid', '==', uid).get();
  for (const snapshot of shared.docs) documents.push(exportedDocument(snapshot));
  const link = await firestore.doc(`quoteEstimatorLinks/${uid}`).get();
  if (link.exists) documents.push(exportedDocument(link));
  const slugs = await firestore
    .collection(SHORT_LINK_COLLECTION)
    .where('ownerUid', '==', uid)
    .get();
  for (const snapshot of slugs.docs) documents.push(exportedDocument(snapshot));
  const noticeId = await findOwnerPrivacyNotice(uid);
  if (noticeId) {
    const notice = await firestore.doc(`${PRIVACY_NOTICE_COLLECTION}/${noticeId}`).get();
    if (notice.exists) documents.push(exportedDocument(notice));
  }

  let authRecord: Json = null;
  try {
    const user = await adminAuth().getUser(uid);
    authRecord = {
      uid: user.uid,
      email: user.email ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime,
    };
  } catch (error) {
    if ((error as { code?: unknown })?.code !== 'auth/user-not-found') throw error;
  }
  logEvent('info', 'account_exported', { subject: pseudonym(uid), documents: documents.length });
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: authRecord,
    documents,
  };
}
