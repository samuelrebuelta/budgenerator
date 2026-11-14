import type {
  CrewInput,
  TeamJob,
  TeamJobAssignment,
  TeamJobDraft,
  WorkCrew,
  WorkforceMember,
} from '@bg/domain/workforce/types';
import { buildTeamJobAssignment, validateTeamJobDraft } from '@bg/domain/workforce/teamJobs';
import { validateCrewInput, validateMemberName } from '@bg/domain/workforce/validation';
import {
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';

const MAX_WORKFORCE_DOCUMENT_BYTES = 900_000;

function assertDocumentId(id: string, label: string) {
  if (!id || id.length > 128 || id.includes('/')) throw new Error(`${label} no válido.`);
}

function assertDocumentSize(value: unknown) {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).length;
  if (byteLength >= MAX_WORKFORCE_DOCUMENT_BYTES)
    throw new Error('El documento supera el límite de 900.000 bytes.');
}

function assertDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('La fecha del trabajo no es válida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month! - 1 || date.getDate() !== day)
    throw new Error('La fecha del trabajo no es válida.');
}

function isSameAssignment(left: TeamJobAssignment, right: TeamJobAssignment) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export interface WorkforceRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

/** Team members, crews and team jobs (BG-014 D2). */
export function createWorkforceRepository({
  sdk,
  database,
  guardMutation: guardNetworkMutation = unguardedMutation,
}: WorkforceRepositoryOptions) {
  const { collection, doc, getDocs, query, runTransaction, setDoc, updateDoc, where } = sdk;

  function membersCollection(database: FirestoreLike, uid: string) {
    return collection(database, 'users', uid, 'teamMembers');
  }

  function crewsCollection(database: FirestoreLike, uid: string) {
    return collection(database, 'users', uid, 'crews');
  }

  function teamJobsCollection(database: FirestoreLike, uid: string) {
    return collection(database, 'users', uid, 'teamJobs');
  }

  async function fetchMembers(uid: string): Promise<WorkforceMember[]> {
    const snapshot = await getDocs(membersCollection(database, uid));
    return snapshot.docs
      .map((item) => ({ ...item.data(), id: item.id }) as WorkforceMember)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async function fetchCrews(uid: string): Promise<WorkCrew[]> {
    const snapshot = await getDocs(crewsCollection(database, uid));
    return snapshot.docs
      .map((item) => ({ ...item.data(), id: item.id }) as WorkCrew)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  async function fetchTeamJobs(
    uid: string,
    startDate: string,
    endDate: string,
  ): Promise<TeamJob[]> {
    assertDateKey(startDate);
    assertDateKey(endDate);
    if (startDate > endDate) throw new Error('El rango de fechas no es válido.');

    const snapshot = await getDocs(
      query(
        teamJobsCollection(database, uid),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
      ),
    );
    const jobs = await Promise.all(
      snapshot.docs.map(async (jobSnapshot) => {
        const assignmentSnapshot = await getDocs(collection(jobSnapshot.ref, 'assignments'));
        const assignments = assignmentSnapshot.docs
          .map((item) => ({ ...item.data(), id: item.id }) as TeamJobAssignment)
          .sort((a, b) => a.id.localeCompare(b.id));
        return { ...jobSnapshot.data(), id: jobSnapshot.id, assignments } as TeamJob;
      }),
    );
    return jobs.sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'),
    );
  }

  async function createTeamJob(uid: string, input: TeamJob): Promise<TeamJob> {
    assertDocumentId(input.id, 'El trabajo');
    const draft: TeamJobDraft = validateTeamJobDraft(input);
    if (
      !input.createdAt ||
      input.createdAt.length > 40 ||
      !input.updatedAt ||
      input.updatedAt.length > 40
    )
      throw new Error('La fecha de creación del trabajo no es válida.');
    const job: TeamJob = {
      ...draft,
      id: input.id,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
    assertDocumentSize(job);

    const jobRef = doc(teamJobsCollection(database, uid), job.id);
    const projectRef = job.projectId
      ? doc(database, 'users', uid, 'projects', job.projectId)
      : null;
    return runTransaction(database, async (transaction) => {
      const existing = await transaction.get(jobRef);
      if (existing.exists()) throw new Error('Ya existe un registro con este ID.');

      if (projectRef) {
        const project = await transaction.get(projectRef);
        if (!project.exists()) throw new Error('No se ha encontrado el proyecto enlazado.');
        const projectData = project.data();
        if (
          projectData.id !== job.projectId ||
          projectData.title !== job.projectTitle ||
          !['pending', 'in_progress', 'completed'].includes(String(projectData.status))
        )
          throw new Error('El proyecto enlazado ha cambiado. Vuelve a elegirlo.');
      }

      const checkedAssignments: TeamJobAssignment[] = [];
      for (const assignment of job.assignments) {
        if (assignment.resourceType === 'member') {
          const memberRef = doc(membersCollection(database, uid), assignment.resourceId);
          const memberSnapshot = await transaction.get(memberRef);
          if (!memberSnapshot.exists())
            throw new Error('No se ha encontrado a la persona asignada.');
          const member = { ...memberSnapshot.data(), id: memberSnapshot.id } as WorkforceMember;
          const checked = buildTeamJobAssignment(
            { type: 'member', resource: member },
            assignment.assignedAt,
          );
          if (!isSameAssignment(checked, assignment))
            throw new Error(
              'La persona asignada ha cambiado. Actualiza el equipo y vuelve a intentarlo.',
            );
          checkedAssignments.push(checked);
          continue;
        }

        const crewRef = doc(crewsCollection(database, uid), assignment.resourceId);
        const crewSnapshot = await transaction.get(crewRef);
        if (!crewSnapshot.exists()) throw new Error('No se ha encontrado la cuadrilla asignada.');
        const crew = { ...crewSnapshot.data(), id: crewSnapshot.id } as WorkCrew;
        const crewMembers: WorkforceMember[] = [];
        for (const memberId of [...new Set(crew.memberIds)]) {
          const memberRef = doc(membersCollection(database, uid), memberId);
          const memberSnapshot = await transaction.get(memberRef);
          if (memberSnapshot.exists())
            crewMembers.push({
              ...memberSnapshot.data(),
              id: memberSnapshot.id,
            } as WorkforceMember);
        }
        const checked = buildTeamJobAssignment(
          { type: 'crew', resource: crew, members: crewMembers },
          assignment.assignedAt,
        );
        if (!isSameAssignment(checked, assignment))
          throw new Error(
            'La cuadrilla asignada ha cambiado. Actualiza el equipo y vuelve a intentarlo.',
          );
        checkedAssignments.push(checked);
      }

      const storedJob = {
        id: job.id,
        title: job.title,
        description: job.description,
        date: job.date,
        ...(job.projectId ? { projectId: job.projectId, projectTitle: job.projectTitle } : {}),
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
      transaction.set(jobRef, storedJob);
      for (const assignment of checkedAssignments)
        transaction.set(doc(jobRef, 'assignments', assignment.id), assignment);
      return { ...job, assignments: checkedAssignments };
    });
  }

  async function saveMember(uid: string, member: WorkforceMember): Promise<void> {
    assertDocumentId(member.id, 'La persona');
    const nextMember = { ...member, name: validateMemberName(member.name) };
    assertDocumentSize(nextMember);
    await setDoc(doc(membersCollection(database, uid), member.id), nextMember);
  }

  async function saveCrew(uid: string, crew: WorkCrew): Promise<void> {
    assertDocumentId(crew.id, 'La cuadrilla');
    assertDocumentSize(crew);
    const crewRef = doc(crewsCollection(database, uid), crew.id);
    const requested = crew as WorkCrew & CrewInput;

    await runTransaction(database, async (transaction) => {
      const current = await transaction.get(crewRef);
      const memberIds = [...new Set(requested.memberIds)];
      if (memberIds.some((id) => !id || id.length > 128 || id.includes('/')))
        throw new Error('La cuadrilla contiene una referencia de persona no válida.');
      const memberRefs = memberIds.map((id) => doc(membersCollection(database, uid), id));
      const memberSnapshots = await Promise.all(
        memberRefs.map((reference) => transaction.get(reference)),
      );
      const members = memberSnapshots.map((snapshot, index) => {
        if (!snapshot.exists()) throw new Error('La cuadrilla contiene una persona que no existe.');
        return { ...snapshot.data(), id: memberIds[index] } as WorkforceMember;
      });
      const normalized = validateCrewInput(
        { label: requested.label, color: requested.color, memberIds },
        members,
        { requireActive: !current.exists() },
      );
      const nextCrew: WorkCrew = {
        ...crew,
        ...normalized,
        id: crewRef.id,
        createdAt: current.exists() ? String(current.data().createdAt) : crew.createdAt,
      };
      assertDocumentSize(nextCrew);
      transaction.set(crewRef, nextCrew);
    });
  }

  async function setMemberStatus(
    uid: string,
    memberId: string,
    status: WorkforceMember['status'],
  ): Promise<void> {
    assertDocumentId(memberId, 'La persona');
    await updateDoc(doc(membersCollection(database, uid), memberId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  async function setCrewStatus(
    uid: string,
    crewId: string,
    status: WorkCrew['status'],
  ): Promise<void> {
    assertDocumentId(crewId, 'La cuadrilla');
    await updateDoc(doc(crewsCollection(database, uid), crewId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    fetchMembers,
    fetchCrews,
    fetchTeamJobs,
    saveMember: guardNetworkMutation(saveMember),
    saveCrew: guardNetworkMutation(saveCrew),
    createTeamJob: guardNetworkMutation(createTeamJob),
    setMemberStatus: guardNetworkMutation(setMemberStatus),
    setCrewStatus: guardNetworkMutation(setCrewStatus),
  };
}

export type WorkforceRepository = ReturnType<typeof createWorkforceRepository>;
