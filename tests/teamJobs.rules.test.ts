import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const emulatorUrl = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`);
const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const now = '2026-11-07T10:00:00.000Z';

const member = {
  id: 'member-1',
  name: 'Ana Pérez',
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

const secondMember = { ...member, id: 'member-2', name: 'Luis Soto' };

const crew = {
  id: 'crew-1',
  label: 'Cuadrilla Alba',
  color: 'green',
  memberIds: [member.id, secondMember.id],
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

const memberAssignment = {
  id: 'member_member-1',
  resourceType: 'member',
  resourceId: member.id,
  label: member.name,
  members: [{ id: member.id, name: member.name }],
  assignedAt: now,
};

const crewAssignment = {
  id: 'crew_crew-1',
  resourceType: 'crew',
  resourceId: crew.id,
  label: crew.label,
  color: crew.color,
  members: [
    { id: member.id, name: member.name },
    { id: secondMember.id, name: secondMember.name },
  ],
  assignedAt: now,
};

const project = {
  id: 'project-1',
  title: 'Casa del Mar',
  status: 'completed',
};

const standaloneJob = {
  id: 'job-1',
  title: 'Remate de cocina',
  description: 'Repasar junta de la encimera.',
  date: '2026-11-07',
  createdAt: now,
  updatedAt: now,
};

const linkedJob = {
  ...standaloneJob,
  id: 'job-linked',
  title: project.title,
  description: '',
  projectId: project.id,
  projectTitle: project.title,
};

async function createJobWithAssignments(
  db: ReturnType<typeof alice>,
  job = standaloneJob,
  assignments = [memberAssignment],
) {
  const jobRef = doc(db, 'users', 'alice', 'teamJobs', job.id);
  await runTransaction(db, async (transaction) => {
    transaction.set(jobRef, job);
    for (const assignment of assignments)
      transaction.set(doc(jobRef, 'assignments', assignment.id), assignment);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bg011-team-jobs',
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
    await setDoc(doc(db, 'users', 'alice', 'teamMembers', member.id), member);
    await setDoc(doc(db, 'users', 'alice', 'teamMembers', secondMember.id), secondMember);
    await setDoc(doc(db, 'users', 'alice', 'crews', crew.id), crew);
    await setDoc(doc(db, 'users', 'alice', 'projects', project.id), project);
  });
});

describe('team job Firestore rules', () => {
  it('allows the owner to atomically create and read a standalone job and member snapshot', async () => {
    const db = alice();
    const reference = doc(db, 'users', 'alice', 'teamJobs', standaloneJob.id);
    await assertSucceeds(createJobWithAssignments(db));
    const snapshot = await assertSucceeds(getDoc(reference));
    expect(snapshot.data()).toEqual(standaloneJob);
    const assignmentSnapshot = await assertSucceeds(
      getDoc(doc(reference, 'assignments', memberAssignment.id)),
    );
    expect(assignmentSnapshot.data()).toEqual(memberAssignment);
  });

  it('allows linking a completed project without mutating it and validates a crew snapshot', async () => {
    const db = alice();
    await assertSucceeds(createJobWithAssignments(db, linkedJob, [crewAssignment]));
    const projectSnapshot = await assertSucceeds(
      getDoc(doc(db, 'users', 'alice', 'projects', project.id)),
    );
    expect(projectSnapshot.data()).toEqual(project);
    const savedCrew = await assertSucceeds(
      getDoc(doc(db, 'users', 'alice', 'teamJobs', linkedJob.id, 'assignments', crewAssignment.id)),
    );
    expect(savedCrew.data()).toEqual(crewAssignment);
  });

  it('allows the owner to query jobs in a date range', async () => {
    const db = alice();
    await createJobWithAssignments(db);
    const jobs = query(
      collection(db, 'users', 'alice', 'teamJobs'),
      where('date', '>=', '2026-11-03'),
      where('date', '<=', '2026-11-09'),
    );
    await assertSucceeds(getDocs(jobs));
  });

  it('creates and loads a standalone job through the Workforce Firestore API', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    const job = { ...standaloneJob, id: 'api-job', assignments: [memberAssignment] };

    await api.createTeamJob('alice', job);
    await expect(api.fetchTeamJobs('alice', '2026-11-07', '2026-11-07')).resolves.toEqual([job]);
  });

  it('creates a job linked to a completed project without changing the project', async () => {
    const { createWorkforceFirestoreApi } = await import('@/entities/workforce/api/firestore');
    const api = createWorkforceFirestoreApi(alice());
    const job = { ...linkedJob, assignments: [crewAssignment] };

    await api.createTeamJob('alice', job);
    await expect(api.fetchTeamJobs('alice', '2026-11-07', '2026-11-07')).resolves.toEqual([job]);
    const projectSnapshot = await getDoc(doc(alice(), 'users', 'alice', 'projects', project.id));
    expect(projectSnapshot.data()).toEqual(project);
  });

  it('denies another account access to the owner job and assignment documents', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await createJobWithAssignments(context.firestore());
    });
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'teamJobs', standaloneJob.id)));
    await assertFails(getDocs(collection(bob(), 'users', 'alice', 'teamJobs')));
    await assertFails(
      getDoc(
        doc(
          bob(),
          'users',
          'alice',
          'teamJobs',
          standaloneJob.id,
          'assignments',
          memberAssignment.id,
        ),
      ),
    );
    await assertFails(setDoc(doc(bob(), 'users', 'alice', 'teamJobs', 'forged'), standaloneJob));
  });

  it('accepts standalone metadata without a description and rejects malformed metadata', async () => {
    const db = alice();
    const jobs = collection(db, 'users', 'alice', 'teamJobs');
    await assertSucceeds(
      createJobWithAssignments(db, {
        ...standaloneJob,
        id: 'empty-description',
        description: '',
      }),
    );
    await assertFails(
      setDoc(doc(jobs, 'impossible-date'), { ...standaloneJob, date: '2026-13-01' }),
    );
    await assertFails(setDoc(doc(jobs, 'malformed-date'), { ...standaloneJob, date: '2026-11-7' }));
    await assertFails(
      setDoc(doc(jobs, 'unlinked-project-title'), {
        ...standaloneJob,
        projectTitle: 'Casa del Mar',
      }),
    );
  });

  it('rejects invalid team snapshots, oversized content and links to missing projects', async () => {
    const db = alice();
    const jobs = collection(db, 'users', 'alice', 'teamJobs');
    await assertFails(
      createJobWithAssignments(db, standaloneJob, [
        { ...memberAssignment, label: 'Invented', members: [{ id: member.id, name: 'Invented' }] },
      ]),
    );
    await assertFails(
      createJobWithAssignments(db, standaloneJob, [
        { ...memberAssignment, id: 'member_inactive', resourceId: 'inactive' },
      ]),
    );
    await assertFails(
      setDoc(doc(jobs, 'oversized-title'), { ...standaloneJob, title: 'x'.repeat(121) }),
    );
    await assertFails(
      setDoc(doc(jobs, 'oversized-description'), {
        ...standaloneJob,
        description: 'x'.repeat(2001),
      }),
    );
    await assertFails(
      setDoc(doc(jobs, 'foreign-project'), {
        ...linkedJob,
        projectId: 'project-owned-by-bob',
      }),
    );
    await assertFails(
      setDoc(doc(jobs, 'mismatched-project-title'), {
        ...linkedJob,
        projectTitle: 'Obra distinta',
      }),
    );
  });

  it('does not allow job or assignment updates and deletes', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await createJobWithAssignments(context.firestore());
    });
    const db = alice();
    const jobRef = doc(db, 'users', 'alice', 'teamJobs', standaloneJob.id);
    const assignmentRef = doc(jobRef, 'assignments', memberAssignment.id);
    await assertFails(updateDoc(jobRef, { title: 'Actualizado' }));
    await assertFails(deleteDoc(jobRef));
    await assertFails(updateDoc(assignmentRef, { label: 'Actualizada' }));
    await assertFails(deleteDoc(assignmentRef));
  });
});
