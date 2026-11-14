import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { deleteAccountData, exportAccountData } from '../src/account/account';

const auth = getAuth();
const firestore = getFirestore();
const token = () => randomUUID().replaceAll('-', '').slice(0, 32);

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Account integration tests require Auth and Firestore emulators.');
});

async function seedAccount() {
  const uid = `account-${randomUUID()}`;
  const otherUid = `account-other-${randomUUID()}`;
  await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  const publicToken = token();
  const batch = firestore.batch();
  batch.set(firestore.doc(`users/${uid}`), { uid, accountData: { plan: 'free' } });
  batch.set(firestore.doc(`users/${uid}/budgets/b1`), { id: 'b1', info: { clientName: 'X' } });
  batch.set(firestore.doc(`users/${uid}/projects/p1`), { id: 'p1' });
  batch.set(firestore.doc(`users/${uid}/projects/p1/workItems/w1`), { id: 'w1' });
  batch.set(firestore.doc(`users/${uid}/leads/l1`), { createdAt: Timestamp.now() });
  batch.set(firestore.doc(`users/${uid}/pushDevices/d1`), {
    registrationToken: 'secret-token-value',
    registrationTokenHash: 'hash',
    enabled: true,
  });
  batch.set(firestore.doc(`sharedBudgets/${token()}`), { ownerUid: uid, expiresAt: 1 });
  batch.set(firestore.doc(`publicQuoteTokens/${publicToken}`), { ownerUid: uid, active: true });
  batch.set(firestore.doc(`quoteEstimatorLinks/${uid}`), { token: publicToken });
  batch.set(firestore.doc(`quoteEstimateRateLimits/${publicToken}`), { count: 1 });
  batch.set(firestore.doc(`quoteLeadRateLimits/${publicToken}`), { count: 1 });
  batch.set(firestore.doc(`pushInstallationIndex/hash-${uid}`), { uid, installationId: 'd1' });
  batch.set(firestore.doc(`notificationDeviceCounts/${uid}`), { count: 1 });
  batch.set(firestore.doc(`leadNotificationJobs/job-${uid}`), { uid, leadId: 'l1' });
  // Another account's data must survive.
  batch.set(firestore.doc(`users/${otherUid}/budgets/b1`), { id: 'b1' });
  batch.set(firestore.doc(`sharedBudgets/${token()}`), { ownerUid: otherUid, expiresAt: 1 });
  await batch.commit();
  return { uid, otherUid, publicToken };
}

describe('account deletion', () => {
  it('deletes every document of the account and the Auth user, and is idempotent', async () => {
    const { uid, otherUid, publicToken } = await seedAccount();

    await expect(deleteAccountData(uid)).resolves.toEqual({ deleted: true, authUserDeleted: true });

    const userTree = await firestore.doc(`users/${uid}`).listCollections();
    expect(userTree).toHaveLength(0);
    expect((await firestore.doc(`users/${uid}`).get()).exists).toBe(false);
    for (const path of [
      `publicQuoteTokens/${publicToken}`,
      `quoteEstimatorLinks/${uid}`,
      `quoteEstimateRateLimits/${publicToken}`,
      `quoteLeadRateLimits/${publicToken}`,
      `pushInstallationIndex/hash-${uid}`,
      `notificationDeviceCounts/${uid}`,
      `leadNotificationJobs/job-${uid}`,
    ])
      expect((await firestore.doc(path).get()).exists, path).toBe(false);
    expect(
      (await firestore.collection('sharedBudgets').where('ownerUid', '==', uid).get()).size,
    ).toBe(0);
    await expect(auth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });

    // Other accounts are untouched.
    expect((await firestore.doc(`users/${otherUid}/budgets/b1`).get()).exists).toBe(true);
    expect(
      (await firestore.collection('sharedBudgets').where('ownerUid', '==', otherUid).get()).size,
    ).toBe(1);

    // A retry after success (or a partial failure) completes without errors.
    await expect(deleteAccountData(uid)).resolves.toEqual({
      deleted: true,
      authUserDeleted: false,
    });
    await firestore.recursiveDelete(firestore.doc(`users/${otherUid}`));
  });
});

describe('account export', () => {
  it('returns every account document without push credentials', async () => {
    const { uid } = await seedAccount();
    const exported = await exportAccountData(uid);
    const paths = exported.documents.map((document) => document.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        `users/${uid}`,
        `users/${uid}/budgets/b1`,
        `users/${uid}/projects/p1/workItems/w1`,
        `users/${uid}/leads/l1`,
        `users/${uid}/pushDevices/d1`,
        `quoteEstimatorLinks/${uid}`,
      ]),
    );
    expect(paths.some((path) => path.startsWith('sharedBudgets/'))).toBe(true);
    expect(JSON.stringify(exported)).not.toContain('secret-token-value');
    expect(exported.account).toMatchObject({ uid, emailVerified: true });
    const lead = exported.documents.find((document) => document.path.endsWith('/leads/l1'));
    expect(typeof (lead?.data as { createdAt?: unknown }).createdAt).toBe('string');
    await deleteAccountData(uid);
  });
});
