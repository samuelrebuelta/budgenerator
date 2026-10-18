import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const settings = {
  services: [
    {
      room: 'bathroom',
      scope: 'partial',
      quality: 'standard',
      lines: [{ conceptId: 'paint', minimumQuantity: 1, maximumQuantity: 2 }],
    },
  ],
  contact: { sharePhone: false, shareEmail: false },
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg005-estimator',
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
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
    await setDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1'), {
      id: 'main-v1',
      parts: [
        {
          id: 'paint',
          name: 'Pintura privada',
          concepts: [{ id: 'paint', basePrice: 12, cost: 1 }],
        },
      ],
    });
    await setDoc(doc(db, 'publicQuoteTokens', 'a'.repeat(32)), { ownerUid: 'alice', active: true });
    await setDoc(doc(db, 'quoteEstimatorLinks', 'alice'), { token: 'a'.repeat(32) });
    await setDoc(doc(db, 'quoteEstimateRateLimits', 'a'.repeat(32)), { count: 1 });
    await setDoc(doc(db, 'users', 'alice', 'leads', 'lead-1'), {
      schemaVersion: 1,
      contact: { name: 'Lucía', email: 'lucia@example.test', phone: '+34 600 123 456' },
      selections: [],
      estimate: { minimumCents: 10000, maximumCents: 20000, currency: 'EUR', includesVat: false },
      createdAt: '2026-10-18T10:00:00.000Z',
      consentAt: '2026-10-18T10:00:00.000Z',
      privacyPolicyUrl: 'https://example.test/privacy',
    });
    await setDoc(doc(db, 'users', 'alice', 'budgets', 'budget-1'), { id: 'budget-1' });
    await setDoc(doc(db, 'users', 'bob', 'budgets', 'budget-2'), { id: 'budget-2' });
  });
});

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe('public estimator Firestore boundary', () => {
  it('lets only the owner read and write their estimator settings', async () => {
    const ownerDoc = doc(alice(), 'users', 'alice', 'quoteEstimator', 'settings');
    await assertSucceeds(setDoc(ownerDoc, settings));
    await assertSucceeds(getDoc(ownerDoc));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'quoteEstimator', 'settings')));
    await assertFails(setDoc(doc(bob(), 'users', 'alice', 'quoteEstimator', 'settings'), settings));
    await assertFails(getDocs(collection(alice(), 'users', 'alice', 'quoteEstimator')));
    await assertFails(getDoc(doc(anonymous(), 'users', 'alice', 'quoteEstimator', 'settings')));
  });

  it('denies client access to token ownership and rate-limit records', async () => {
    for (const db of [anonymous(), alice(), bob()]) {
      await assertFails(getDoc(doc(db, 'publicQuoteTokens', 'a'.repeat(32))));
      await assertFails(
        setDoc(doc(db, 'publicQuoteTokens', 'forged'), { ownerUid: 'alice', active: true }),
      );
      await assertFails(getDoc(doc(db, 'quoteEstimatorLinks', 'alice')));
      await assertFails(setDoc(doc(db, 'quoteEstimatorLinks', 'alice'), { token: 'forged' }));
      await assertFails(getDoc(doc(db, 'quoteEstimateRateLimits', 'a'.repeat(32))));
      await assertFails(getDocs(collection(db, 'publicQuoteTokens')));
    }
  });

  it('does not let a public caller use the token as a catalog read path', async () => {
    const db = anonymous();
    await assertFails(getDoc(doc(db, 'users', 'alice', 'tariffCatalogs', 'main-v1')));
    await assertFails(getDoc(doc(db, 'users', 'alice', 'quoteEstimator', 'settings')));
    await assertFails(getDoc(doc(db, 'publicQuoteTokens', 'a'.repeat(32))));
  });

  it('lets only the owner read/list and manually delete leads', async () => {
    const ownLead = doc(alice(), 'users', 'alice', 'leads', 'lead-1');
    await assertSucceeds(getDoc(ownLead));
    await assertSucceeds(getDocs(collection(alice(), 'users', 'alice', 'leads')));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'leads', 'lead-1')));
    await assertFails(getDocs(collection(bob(), 'users', 'alice', 'leads')));
    await assertFails(getDoc(doc(anonymous(), 'users', 'alice', 'leads', 'lead-1')));
    await assertFails(deleteDoc(doc(bob(), 'users', 'alice', 'leads', 'lead-1')));
    await assertSucceeds(deleteDoc(ownLead));
  });

  it('denies client lead creation and contact edits but allows linking its own budget', async () => {
    const ownLead = doc(alice(), 'users', 'alice', 'leads', 'lead-1');
    await assertFails(setDoc(doc(alice(), 'users', 'alice', 'leads', 'forged'), { contact: {} }));
    await assertFails(updateDoc(ownLead, { contact: { name: 'Changed' } }));
    await assertSucceeds(updateDoc(ownLead, { budgetId: 'budget-1' }));
    await assertFails(
      updateDoc(doc(alice(), 'users', 'alice', 'leads', 'lead-1'), { budgetId: 'budget-2' }),
    );
    await assertFails(updateDoc(ownLead, { budgetId: 'missing-budget' }));
    await assertFails(
      updateDoc(doc(bob(), 'users', 'alice', 'leads', 'lead-1'), { budgetId: 'budget-1' }),
    );
  });

  it('keeps public lead rate limits server-only', async () => {
    for (const db of [anonymous(), alice(), bob()]) {
      await assertFails(getDoc(doc(db, 'quoteLeadRateLimits', 'a'.repeat(32))));
      await assertFails(setDoc(doc(db, 'quoteLeadRateLimits', 'forged'), { count: 1 }));
    }
  });
});
