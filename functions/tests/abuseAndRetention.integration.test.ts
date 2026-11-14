import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { consumeRateLimits, RATE_LIMIT_COLLECTION } from '../src/abuse/rateLimit';
import { guardPublicLeadCall } from '../src/abuse/publicGuards';
import { allowLeadPush } from '../src/notifications/leadCreated';
import { registerPushDevice } from '../src/notifications/preferences';
import { applyDataRetention, cleanupInactivePushDevices } from '../src/retention/retention';

const auth = getAuth();
const firestore = getFirestore();
const DAY = 86_400_000;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Abuse and retention integration tests require Auth and Firestore emulators.');
});

describe('rate limits', () => {
  it('counts per subject and window and reports the exceeded scope', async () => {
    const subject = randomUUID();
    const rule = { scope: 'test_scope', subject, limit: 2, windowMs: 60_000 };
    const now = Date.UTC(2026, 10, 12, 10, 0, 30);
    expect(await consumeRateLimits([rule], now)).toBeNull();
    expect(await consumeRateLimits([rule], now)).toBeNull();
    expect(await consumeRateLimits([rule], now)).toBe('test_scope');
    // Another subject and the next window have their own budget.
    expect(await consumeRateLimits([{ ...rule, subject: randomUUID() }], now)).toBeNull();
    expect(await consumeRateLimits([rule], now + 60_000)).toBeNull();
    const stored = await firestore
      .collection(RATE_LIMIT_COLLECTION)
      .where('scope', '==', 'test_scope')
      .get();
    // Subjects are stored hashed, never in clear text.
    expect(stored.docs.every((document) => !document.id.includes(subject))).toBe(true);
    expect(stored.docs.every((document) => document.get('expiresAt') instanceof Timestamp)).toBe(
      true,
    );
  });

  it('does not consume other rules when one of them is exhausted', async () => {
    const full = { scope: 'test_full', subject: randomUUID(), limit: 1, windowMs: 60_000 };
    const free = { scope: 'test_free', subject: randomUUID(), limit: 5, windowMs: 60_000 };
    const now = Date.now();
    await consumeRateLimits([full], now);
    expect(await consumeRateLimits([free, full], now)).toBe('test_full');
    expect(await consumeRateLimits([free], now)).toBeNull();
  });

  it('throttles public leads per network with resource-exhausted', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    const request = {
      app: undefined,
      data: { token: 'x'.repeat(32) },
      rawRequest: { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } },
    } as unknown as Parameters<typeof guardPublicLeadCall>[0];
    for (let i = 0; i < 10; i += 1) await guardPublicLeadCall(request);
    const error = await guardPublicLeadCall(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpsError);
    expect(error).toMatchObject({
      code: 'resource-exhausted',
      details: { reason: 'rate_limited' },
    });
  });

  it('limits lead pushes per owner and hour', async () => {
    const uid = `push-${randomUUID()}`;
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) expect(await allowLeadPush(uid, now)).toBe(true);
    expect(await allowLeadPush(uid, now)).toBe(false);
  });
});

describe('retention', () => {
  it('anonymizes old leads and deletes expired public snapshots and counters only', async () => {
    const uid = `retention-${randomUUID()}`;
    const now = Date.now();
    const old = firestore.doc(`users/${uid}/leads/old`);
    const recent = firestore.doc(`users/${uid}/leads/recent`);
    const expired = firestore.doc(`sharedBudgets/expired-${uid}`);
    const active = firestore.doc(`sharedBudgets/active-${uid}`);
    const staleCounter = firestore.doc(`${RATE_LIMIT_COLLECTION}/stale-${uid}`);
    const legacyCounter = firestore.doc(`quoteLeadRateLimits/legacy-${uid}`);
    await Promise.all([
      old.set({
        createdAt: Timestamp.fromMillis(Date.UTC(2025, 8, 15)),
        consentAt: Timestamp.fromMillis(Date.UTC(2025, 8, 15)),
        contact: { name: 'Ana', email: 'ana@example.test', phone: '600000000' },
        requestHash: 'hash',
        selections: [{ room: 'bathroom', scope: 'partial', quality: 'medium', area: 6 }],
        estimate: { min: 2400, max: 4200, currency: 'EUR', includesVat: false },
        budgetId: 'budget-1',
      }),
      recent.set({
        createdAt: Timestamp.fromMillis(now - 30 * DAY),
        contact: { name: 'Luis', email: 'luis@example.test', phone: '611111111' },
      }),
      expired.set({ ownerUid: uid, expiresAt: now - 1000 }),
      active.set({ ownerUid: uid, expiresAt: now + DAY }),
      staleCounter.set({ count: 3, expiresAt: Timestamp.fromMillis(now - 1000) }),
      legacyCounter.set({ count: 1, updatedAt: Timestamp.fromMillis(now - 3 * DAY) }),
    ]);

    const result = await applyDataRetention(now);
    expect(result.leadsAnonymized).toBeGreaterThanOrEqual(1);
    const anonymized = (await old.get()).data()!;
    expect(anonymized.contact).toBeUndefined();
    expect(anonymized.consentAt).toBeUndefined();
    expect(anonymized.requestHash).toBeUndefined();
    expect(anonymized.createdAt).toBeUndefined();
    expect(anonymized.receivedMonth).toBe('2025-09');
    expect(anonymized.anonymizedAt).toBeInstanceOf(Timestamp);
    expect(anonymized.selections).toHaveLength(1);
    expect(anonymized.estimate).toMatchObject({ min: 2400, max: 4200 });
    expect(anonymized.budgetId).toBe('budget-1');
    expect((await recent.get()).data()!.contact).toMatchObject({ name: 'Luis' });
    // A second run does not touch the lead again (it no longer has `createdAt`).
    await applyDataRetention(now);
    expect((await old.get()).get('anonymizedAt')).toEqual(anonymized.anonymizedAt);
    expect((await expired.get()).exists).toBe(false);
    expect((await active.get()).exists).toBe(true);
    expect((await staleCounter.get()).exists).toBe(false);
    expect((await legacyCounter.get()).exists).toBe(false);
    await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
    await active.delete();
  });

  it('removes push devices that are inactive or waiting for recovery too long', async () => {
    const uid = `devices-${randomUUID()}`;
    await auth.createUser({ uid, email: `${uid}@example.test` });
    const ids = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'];
    for (const [index, installationId] of ids.entries())
      await registerPushDevice(uid, {
        installationId,
        registrationToken: `token-${index}-${'x'.repeat(40)}`,
        platform: 'android',
      });
    const now = Date.now();
    await firestore
      .doc(`users/${uid}/pushDevices/${ids[0]}`)
      .update({ lastSeenAt: Timestamp.fromMillis(now - 300 * DAY) });
    const kept = await firestore.doc(`users/${uid}/pushDevices/${ids[1]}`).get();
    expect(kept.get('platform')).toBe('android');

    const { removed } = await cleanupInactivePushDevices(now);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect((await firestore.doc(`users/${uid}/pushDevices/${ids[0]}`).get()).exists).toBe(false);
    expect((await firestore.doc(`users/${uid}/pushDevices/${ids[1]}`).get()).exists).toBe(true);
    expect((await firestore.doc(`notificationDeviceCounts/${uid}`).get()).get('count')).toBe(1);

    await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
    const indexes = await firestore
      .collection('pushInstallationIndex')
      .where('uid', '==', uid)
      .get();
    await Promise.all(indexes.docs.map((document) => document.ref.delete()));
    await firestore.doc(`notificationDeviceCounts/${uid}`).delete();
    await auth.deleteUser(uid);
  });
});
