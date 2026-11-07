import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const projectId = 'project-1';
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const memberAssignment = {
  id: 'member_member-1',
  resourceType: 'member',
  resourceId: 'member-1',
  label: 'Ana Pérez',
  members: [{ id: 'member-1', name: 'Ana Pérez' }],
  assignedAt: '2026-11-05T10:00:00.000Z',
};
const crewAssignment = {
  id: 'crew_crew-1',
  resourceType: 'crew',
  resourceId: 'crew-1',
  label: 'Albañilería',
  color: 'green',
  members: [{ id: 'member-1', name: 'Ana Pérez' }],
  assignedAt: '2026-11-05T10:00:00.000Z',
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-assignments',
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
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
    await setDoc(doc(db, 'users', 'alice', 'projects', projectId), {
      id: projectId,
      title: 'Reforma',
    });
    await setDoc(doc(db, 'users', 'alice', 'teamMembers', 'member-1'), {
      id: 'member-1',
      name: 'Ana Pérez',
      status: 'active',
    });
    await setDoc(doc(db, 'users', 'alice', 'teamMembers', 'inactive-1'), {
      id: 'inactive-1',
      name: 'Hugo Soler',
      status: 'inactive',
    });
    await setDoc(doc(db, 'users', 'alice', 'crews', 'crew-1'), {
      id: 'crew-1',
      label: 'Albañilería',
      color: 'green',
      memberIds: ['member-1'],
      status: 'active',
    });
  });
});

describe('project assignment Firestore boundary', () => {
  it('allows the project owner to create, read and remove a valid snapshot', async () => {
    const ref = doc(
      alice(),
      'users',
      'alice',
      'projects',
      projectId,
      'assignments',
      memberAssignment.id,
    );
    await assertSucceeds(setDoc(ref, memberAssignment));
    expect((await getDoc(ref)).data()).toEqual(memberAssignment);
    await expect(
      getDocs(collection(alice(), 'users', 'alice', 'projects', projectId, 'assignments')),
    ).resolves.toMatchObject({ size: 1 });
    await assertSucceeds(deleteDoc(ref));
  });

  it('blocks assigning a person who is already included in an assigned crew', async () => {
    await setDoc(
      doc(alice(), 'users', 'alice', 'projects', projectId, 'assignments', crewAssignment.id),
      crewAssignment,
    );
    const api = createProjectFirestoreApi(alice());

    await expect(api.addAssignment('alice', projectId, 'member', 'member-1')).rejects.toThrow(
      /incluida en una cuadrilla asignada/i,
    );
    const directAssignment = await getDoc(
      doc(alice(), 'users', 'alice', 'projects', projectId, 'assignments', memberAssignment.id),
    );
    expect(directAssignment.exists()).toBe(false);
  });

  it('denies another account access and denies assignments for a missing project', async () => {
    const ownAssignment = doc(
      bob(),
      'users',
      'alice',
      'projects',
      projectId,
      'assignments',
      memberAssignment.id,
    );
    await assertFails(getDoc(ownAssignment));
    await assertFails(setDoc(ownAssignment, memberAssignment));
    await assertFails(
      setDoc(
        doc(alice(), 'users', 'alice', 'projects', 'missing', 'assignments', memberAssignment.id),
        memberAssignment,
      ),
    );
  });

  it('rejects forged IDs, unknown fields and malformed snapshots', async () => {
    const assignments = collection(alice(), 'users', 'alice', 'projects', projectId, 'assignments');
    await assertFails(setDoc(doc(assignments, 'forged'), { ...memberAssignment, id: 'forged' }));
    await assertFails(
      setDoc(doc(assignments, memberAssignment.id), { ...memberAssignment, extra: true }),
    );
    await assertFails(
      setDoc(doc(assignments, memberAssignment.id), { ...memberAssignment, resourceType: 'crew' }),
    );
  });

  it('only accepts active resources owned by the project account and exact crew snapshots', async () => {
    const assignments = collection(alice(), 'users', 'alice', 'projects', projectId, 'assignments');
    await assertSucceeds(setDoc(doc(assignments, crewAssignment.id), crewAssignment));
    await assertFails(
      setDoc(doc(assignments, 'member_missing'), {
        ...memberAssignment,
        id: 'member_missing',
        resourceId: 'missing',
        members: [{ id: 'missing', name: 'Ana Pérez' }],
      }),
    );
    await assertFails(
      setDoc(doc(assignments, 'member_inactive-1'), {
        ...memberAssignment,
        id: 'member_inactive-1',
        resourceId: 'inactive-1',
        label: 'Hugo Soler',
        members: [{ id: 'inactive-1', name: 'Hugo Soler' }],
      }),
    );
    await assertFails(
      setDoc(doc(assignments, crewAssignment.id), { ...crewAssignment, label: 'Otra cuadrilla' }),
    );
  });
});
