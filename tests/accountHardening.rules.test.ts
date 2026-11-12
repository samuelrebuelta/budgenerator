import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { user } from './fixtures';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-account-rules',
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
});

const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
const smallLogo = `data:image/webp;base64,${'A'.repeat(1000)}`;
const profile = (patch: Record<string, unknown> = {}) => ({
  name: 'Reformas Demo',
  cif: 'B00000000',
  address: 'Calle Falsa 1',
  phone: '+34 600 000 000',
  email: 'demo@example.test',
  privacyPolicyUrl: 'https://example.test/privacidad',
  logo: smallLogo,
  ...patch,
});

describe('legal acceptance on registration', () => {
  it('stores the accepted version with the server time', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'users', 'alice'), {
        ...user('alice'),
        legalAcceptance: { version: '2026-11', acceptedAt: serverTimestamp() },
      }),
    );
  });
  it('rejects a client-chosen acceptance date or extra fields', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice'), {
        ...user('alice'),
        legalAcceptance: { version: '2026-11', acceptedAt: '2020-01-01T00:00:00Z' },
      }),
    );
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice'), {
        ...user('alice'),
        legalAcceptance: { version: '2026-11', acceptedAt: serverTimestamp(), ip: 'x' },
      }),
    );
  });
  it('keeps registration without acceptance valid for accounts created before the change', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', 'alice'), user('alice')));
  });
});

describe('company profile', () => {
  it('lets the owner save a compressed logo and a valid privacy URL', async () => {
    const ref = doc(alice(), 'users', 'alice', 'profile', 'data');
    await assertSucceeds(setDoc(ref, profile()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, profile({ logo: '', privacyPolicyUrl: '' })));
    await assertSucceeds(deleteDoc(ref));
  });
  it('rejects oversized or non-image logos', async () => {
    const ref = doc(alice(), 'users', 'alice', 'profile', 'data');
    await assertFails(
      setDoc(ref, profile({ logo: `data:image/png;base64,${'A'.repeat(200_001)}` })),
    );
    await assertFails(setDoc(ref, profile({ logo: 'javascript:alert(1)' })));
    await assertFails(setDoc(ref, profile({ logo: 'data:text/html;base64,AAAA' })));
  });
  it('rejects unknown fields, insecure privacy URLs and other document ids', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice', 'profile', 'data'), profile({ isAdmin: true })),
    );
    await assertFails(
      setDoc(
        doc(alice(), 'users', 'alice', 'profile', 'data'),
        profile({ privacyPolicyUrl: 'http://example.test' }),
      ),
    );
    await assertFails(setDoc(doc(alice(), 'users', 'alice', 'profile', 'other'), profile()));
  });
  it('isolates profiles between accounts', async () => {
    await assertFails(setDoc(doc(bob(), 'users', 'alice', 'profile', 'data'), profile()));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'profile', 'data')));
  });
});

describe('server-only collections added by the hardening', () => {
  it('denies client access to abuse counters', async () => {
    await assertFails(getDoc(doc(alice(), 'abuseRateLimits', 'lead_ip_x_1')));
    await assertFails(setDoc(doc(alice(), 'abuseRateLimits', 'lead_ip_x_1'), { count: 0 }));
  });
});
