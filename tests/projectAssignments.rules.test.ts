import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const projectId = 'project-1';
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const assignmentStateRef = (db: ReturnType<typeof alice>) =>
  doc(db, 'users', 'alice', 'projects', projectId, 'assignmentState', 'current');

async function writeAssignmentWithState(
  db: ReturnType<typeof alice>,
  assignmentId: string,
  data: Record<string, unknown>,
) {
  const stateRef = assignmentStateRef(db);
  const stateSnapshot = await getDoc(stateRef);
  const revision = stateSnapshot.exists() ? stateSnapshot.data().revision : 0;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', 'alice', 'projects', projectId, 'assignments', assignmentId), data);
  batch.set(stateRef, { revision: revision + 1 });
  await batch.commit();
}
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
    const api = createProjectFirestoreApi(alice());
    await expect(
      api.addAssignment('alice', projectId, 'member', 'member-1'),
    ).resolves.toMatchObject({ ...memberAssignment, assignedAt: expect.any(String) });
    expect((await getDoc(ref)).data()).toMatchObject({
      ...memberAssignment,
      assignedAt: expect.any(String),
    });
    await expect(
      getDocs(collection(alice(), 'users', 'alice', 'projects', projectId, 'assignments')),
    ).resolves.toMatchObject({ size: 1 });
    await expect(
      api.removeAssignment('alice', projectId, memberAssignment.id),
    ).resolves.toBeUndefined();
    expect((await getDoc(ref)).exists()).toBe(false);
  });

  it('requires an atomic assignment-state revision when writing an assignment', async () => {
    await assertFails(
      setDoc(
        doc(alice(), 'users', 'alice', 'projects', projectId, 'assignments', memberAssignment.id),
        memberAssignment,
      ),
    );
  });

  it('blocks assigning a person who is already included in an assigned crew', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'users',
          'alice',
          'projects',
          projectId,
          'assignments',
          crewAssignment.id,
        ),
        crewAssignment,
      );
    });
    const api = createProjectFirestoreApi(alice());

    await expect(api.addAssignment('alice', projectId, 'member', 'member-1')).rejects.toThrow(
      /incluida en una cuadrilla asignada/i,
    );
    const directAssignment = await getDoc(
      doc(alice(), 'users', 'alice', 'projects', projectId, 'assignments', memberAssignment.id),
    );
    expect(directAssignment.exists()).toBe(false);
  });

  it('blocks assigning a crew that contains a person already assigned individually', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'users',
          'alice',
          'projects',
          projectId,
          'assignments',
          memberAssignment.id,
        ),
        memberAssignment,
      );
    });
    const api = createProjectFirestoreApi(alice());

    await expect(api.addAssignment('alice', projectId, 'crew', 'crew-1')).rejects.toThrow(
      /ya asignada individualmente/i,
    );
    const crewAssignmentSnapshot = await getDoc(
      doc(alice(), 'users', 'alice', 'projects', projectId, 'assignments', crewAssignment.id),
    );
    expect(crewAssignmentSnapshot.exists()).toBe(false);
  });

  it('serializes concurrent member and crew assignments that share a person', async () => {
    const api = createProjectFirestoreApi(alice());

    const outcomes = await Promise.allSettled([
      api.addAssignment('alice', projectId, 'member', 'member-1'),
      api.addAssignment('alice', projectId, 'crew', 'crew-1'),
    ]);
    const savedAssignments = await getDocs(
      collection(alice(), 'users', 'alice', 'projects', projectId, 'assignments'),
    );

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(savedAssignments.size).toBe(1);
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
    const db = alice();
    await assertFails(
      writeAssignmentWithState(db, 'forged', { ...memberAssignment, id: 'forged' }),
    );
    await assertFails(
      writeAssignmentWithState(db, memberAssignment.id, { ...memberAssignment, extra: true }),
    );
    await assertFails(
      writeAssignmentWithState(db, memberAssignment.id, {
        ...memberAssignment,
        resourceType: 'crew',
      }),
    );
  });

  it('only accepts active resources owned by the project account and exact crew snapshots', async () => {
    const db = alice();
    await assertSucceeds(writeAssignmentWithState(db, crewAssignment.id, crewAssignment));
    await assertFails(
      writeAssignmentWithState(db, 'member_missing', {
        ...memberAssignment,
        id: 'member_missing',
        resourceId: 'missing',
        members: [{ id: 'missing', name: 'Ana Pérez' }],
      }),
    );
    await assertFails(
      writeAssignmentWithState(db, 'member_inactive-1', {
        ...memberAssignment,
        id: 'member_inactive-1',
        resourceId: 'inactive-1',
        label: 'Hugo Soler',
        members: [{ id: 'inactive-1', name: 'Hugo Soler' }],
      }),
    );
    await assertFails(
      writeAssignmentWithState(db, crewAssignment.id, {
        ...crewAssignment,
        label: 'Otra cuadrilla',
      }),
    );
  });
});
