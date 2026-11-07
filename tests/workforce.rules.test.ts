import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const emulatorUrl = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`);
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const makeMember = (id: string, status: 'active' | 'inactive' = 'active') => ({
  id,
  name: 'Ana Pérez',
  status,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-workforce',
    firestore: {
      host: emulatorUrl.hostname,
      port: Number(emulatorUrl.port),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'alice'), { uid: 'alice' });
    await setDoc(doc(db, 'users', 'bob'), { uid: 'bob' });
  });
});

describe('workforce Firestore API and rules', () => {
  it('allows an owner to write a valid member document', async () => {
    const member = makeMember('member-1');
    await setDoc(doc(alice(), 'users', 'alice', 'teamMembers', member.id), member);
  });

  it('lets an owner create and read members and crews and change their status', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    const member = makeMember('member-1');
    await api.saveMember('alice', member);
    await expect(api.fetchMembers('alice')).resolves.toEqual([member]);

    const crew = {
      id: 'crew-1',
      label: 'Alba',
      color: 'blue' as const,
      memberIds: ['member-1'],
      status: 'active' as const,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
    await api.saveCrew('alice', crew);
    await expect(api.fetchCrews('alice')).resolves.toEqual([crew]);
    await api.setMemberStatus('alice', 'member-1', 'inactive');
    await api.setCrewStatus('alice', 'crew-1', 'inactive');
    await expect(api.fetchMembers('alice')).resolves.toMatchObject([{ status: 'inactive' }]);
    await expect(api.fetchCrews('alice')).resolves.toMatchObject([{ status: 'inactive' }]);
  });

  it('denies another account access to members and crews', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    await api.saveMember('alice', makeMember('member-1'));
    const memberRef = doc(bob(), 'users', 'alice', 'teamMembers', 'member-1');
    const crewRef = doc(bob(), 'users', 'alice', 'crews', 'crew-1');
    await assertFails(getDoc(memberRef));
    await assertFails(getDocs(collection(bob(), 'users', 'alice', 'teamMembers')));
    await assertFails(setDoc(crewRef, { id: 'crew-1' }));
  });

  it('rejects malformed member and crew documents', async () => {
    const db = alice();
    const members = collection(db, 'users', 'alice', 'teamMembers');
    const crews = collection(db, 'users', 'alice', 'crews');
    await assertFails(setDoc(doc(members, 'blank'), { ...makeMember('blank'), name: '  ' }));
    await assertFails(
      setDoc(doc(members, 'bad-status'), { ...makeMember('bad-status'), status: 'paused' }),
    );
    await assertFails(
      setDoc(doc(crews, 'bad-color'), {
        id: 'bad-color',
        label: 'Equipo',
        color: 'black',
        memberIds: ['member-1'],
        status: 'active',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      }),
    );
    await assertFails(
      setDoc(doc(crews, 'bad-status'), {
        id: 'bad-status',
        label: 'Equipo',
        color: 'blue',
        memberIds: ['member-1'],
        status: 'paused',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      }),
    );
  });

  it('rejects a crew with missing or inactive members and oversized documents', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    await expect(
      api.saveCrew('alice', {
        id: 'unknown',
        label: 'Alba',
        color: 'blue',
        memberIds: ['missing'],
        status: 'active',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      }),
    ).rejects.toThrow(/no existe/i);
    await api.saveMember('alice', makeMember('inactive', 'inactive'));
    await expect(
      api.saveCrew('alice', {
        id: 'inactive-crew',
        label: 'Tarde',
        color: 'green',
        memberIds: ['inactive'],
        status: 'active',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      }),
    ).rejects.toThrow(/activa/i);
    await expect(
      api.saveCrew('alice', {
        id: 'oversized',
        label: 'Gran equipo',
        color: 'blue',
        memberIds: ['x'.repeat(900_000)],
        status: 'active',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      }),
    ).rejects.toThrow(/900/);
  });

  it('allows updating status only through valid owner records', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    await api.saveMember('alice', makeMember('member-1'));
    await assertFails(
      updateDoc(doc(alice(), 'users', 'alice', 'teamMembers', 'member-1'), { status: 'paused' }),
    );
  });
});
