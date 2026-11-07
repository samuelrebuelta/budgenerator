import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { createProjectFirestoreApi } from '../src/entities/project/api/firestore';

let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
const schedule = {
  date: '2026-11-09',
  projectId: 'project-1',
  assignments: [],
  updatedAt: '2026-11-06T10:00:00.000Z',
};
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-daily-assignments',
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
    await setDoc(doc(db, 'users', 'alice', 'projects', 'project-1'), {
      id: 'project-1',
      title: 'Cocina',
      status: 'in_progress',
    });
    await setDoc(doc(db, 'users', 'alice', 'projects', 'completed-project'), {
      id: 'completed-project',
      title: 'Baño',
      status: 'completed',
    });
  });
});

function scheduleRef(db: ReturnType<typeof alice>, projectId = 'project-1', date = schedule.date) {
  return doc(db, 'users', 'alice', 'projects', projectId, 'dailyAssignments', date);
}

describe('project daily assignment Firestore boundary', () => {
  it('rejects malformed assignment snapshots before writing a day override', async () => {
    const api = createProjectFirestoreApi(alice());

    await expect(
      api.saveDailyAssignments('alice', 'project-1', schedule.date, [
        { resourceId: 'member-1' },
      ] as never),
    ).rejects.toThrow(/asignación/i);
  });

  it('allows the owner to create, read, update, and remove a valid day override', async () => {
    const ref = scheduleRef(alice());
    await assertSucceeds(setDoc(ref, schedule));
    expect((await getDoc(ref)).data()).toEqual(schedule);
    await assertSucceeds(setDoc(ref, { ...schedule, assignments: [{ resourceId: 'member-1' }] }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('denies another account, a missing project, and writes to completed projects', async () => {
    await assertFails(getDoc(scheduleRef(bob())));
    await assertFails(setDoc(scheduleRef(alice(), 'missing-project'), schedule));
    await assertFails(
      setDoc(scheduleRef(alice(), 'completed-project'), {
        ...schedule,
        projectId: 'completed-project',
      }),
    );
  });

  it('rejects a mismatched date, unknown fields, and non-list assignments', async () => {
    await assertFails(setDoc(scheduleRef(alice()), { ...schedule, date: '2026-11-10' }));
    await assertFails(setDoc(scheduleRef(alice()), { ...schedule, unexpected: true }));
    await assertFails(setDoc(scheduleRef(alice()), { ...schedule, assignments: {} }));
  });

  it('loads permanent defaults and daily overrides, and can restore the defaults', async () => {
    const assignment = {
      id: 'member_member-1',
      resourceType: 'member',
      resourceId: 'member-1',
      label: 'Ana Pérez',
      members: [{ id: 'member-1', name: 'Ana Pérez' }],
      assignedAt: '2026-11-06T10:00:00.000Z',
    };
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'users',
          'alice',
          'projects',
          'project-1',
          'assignments',
          assignment.id,
        ),
        assignment,
      );
    });
    const api = createProjectFirestoreApi(alice());

    const loaded = await api.fetchTeamSchedule('alice', ['project-1'], [schedule.date]);
    expect(loaded.assignmentsByProjectId['project-1']).toEqual([assignment]);
    expect(loaded.overridesByProjectDate).toEqual({});

    await api.saveDailyAssignments('alice', 'project-1', schedule.date, []);
    const overridden = await api.fetchTeamSchedule('alice', ['project-1'], [schedule.date]);
    expect(overridden.overridesByProjectDate[`project-1:${schedule.date}`]?.assignments).toEqual(
      [],
    );

    await api.removeDailyAssignmentOverride('alice', 'project-1', schedule.date);
    const restored = await api.fetchTeamSchedule('alice', ['project-1'], [schedule.date]);
    expect(restored.overridesByProjectDate).toEqual({});
  });
});
