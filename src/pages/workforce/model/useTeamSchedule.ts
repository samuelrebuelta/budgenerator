import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getWeekDateKeys,
  useProjectStore,
  type ProjectAssignment,
  type ProjectTeamScheduleData,
} from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import {
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '@/shared/lib/memoryResourceCache';
import { shiftWeeks, startOfWeek, dateFromKey, type DateKey } from '@/shared/lib';
import { reportNetworkUnavailable, useNetworkStore } from '@/shared/model/network';
import { TEAM_COPY } from './copy';
import { teamErrorMessage } from './teamErrors';

const EMPTY_TEAM_SCHEDULE: ProjectTeamScheduleData = {
  assignmentsByProjectId: {},
  overridesByProjectDate: {},
};

export interface LastTeamSchedule {
  dateKeys: DateKey[];
  data: ProjectTeamScheduleData;
}

/** Last schedule shown, used to open the same week offline. */
export function lastScheduleKey(uid: string) {
  return `private:${uid}:team-schedule:last`;
}

function scheduleResourceKey(uid: string, projectIdsKey: string, dateKeys: DateKey[]) {
  return `private:${uid}:team-schedule:${projectIdsKey}:${dateKeys.join('|')}`;
}

/**
 * Weekly plan of the visible week: project snapshots, daily overrides and one-off jobs. Shows
 * cached weeks immediately, revalidates them, prefetches the adjacent weeks and shares
 * in-flight requests between prefetch and navigation (docs/state-and-cache.md).
 */
export function useTeamSchedule(uid: string | undefined, dateKeys: DateKey[]) {
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const projects = useProjectStore((state) => state.projects);
  const projectsLoaded = useProjectStore((state) => state.loaded);
  const loadTeamSchedule = useProjectStore((state) => state.loadTeamSchedule);
  const saveDailyAssignments = useProjectStore((state) => state.saveDailyAssignments);
  const removeDailyAssignmentOverride = useProjectStore(
    (state) => state.removeDailyAssignmentOverride,
  );
  const teamJobs = useWorkforceStore((state) => state.teamJobs);
  const teamJobsRange = useWorkforceStore((state) => state.teamJobsRange);
  const loadTeamJobs = useWorkforceStore((state) => state.loadTeamJobs);

  const [scheduleData, setScheduleData] = useState(
    () =>
      (uid ? getMemoryResource<LastTeamSchedule>(lastScheduleKey(uid))?.data : undefined) ??
      EMPTY_TEAM_SCHEDULE,
  );
  const [scheduleAttempt, setScheduleAttempt] = useState(0);
  const [scheduleFailure, setScheduleFailure] = useState<{ key: string; error: string } | null>(
    null,
  );
  const [loadedScheduleKey, setLoadedScheduleKey] = useState('');
  const [jobsAttempt, setJobsAttempt] = useState(0);
  const [jobsFailure, setJobsFailure] = useState<{ key: string; error: string } | null>(null);
  const [loadedJobsKey, setLoadedJobsKey] = useState('');
  const inFlight = useRef(new Map<string, Promise<ProjectTeamScheduleData | null>>());

  const projectIds = useMemo(() => projects.map((project) => project.id).sort(), [projects]);
  const projectIdsKey = projectIds.join('|');
  const dateKeysKey = dateKeys.join('|');
  const startDate = dateKeys[0]!;
  const endDate = dateKeys[dateKeys.length - 1]!;
  const resourceKey = scheduleResourceKey(uid ?? '', projectIdsKey, dateKeys);
  const cachedSchedule = uid ? getMemoryResource<ProjectTeamScheduleData>(resourceKey) : undefined;
  const scheduleKey = `${uid ?? ''}:${scheduleAttempt}:${projectIdsKey}:${dateKeysKey}`;
  const jobsKey = `${uid ?? ''}:${jobsAttempt}:${startDate}:${endDate}`;
  const scheduleError = scheduleFailure?.key === scheduleKey ? scheduleFailure.error : '';
  const jobsError = jobsFailure?.key === jobsKey ? jobsFailure.error : '';
  const scheduleLoading = online && loadedScheduleKey !== scheduleKey && !cachedSchedule;
  const jobsLoading = online && loadedJobsKey !== jobsKey;
  const scheduleUnavailable = !online && !cachedSchedule;
  const jobsUnavailable =
    !online &&
    (!teamJobsRange ||
      teamJobsRange.uid !== uid ||
      teamJobsRange.startDate !== startDate ||
      teamJobsRange.endDate !== endDate);

  const loadScheduleResource = useCallback(
    (key: string, keys: DateKey[], refresh: boolean) => {
      const pending = inFlight.current.get(key);
      if (pending) return pending;
      const cached = getMemoryResource<ProjectTeamScheduleData>(key);
      if (!refresh && cached !== undefined) return Promise.resolve(cached);
      if (!uid) return Promise.reject(new Error('No hay una sesión activa.'));
      const request = loadMemoryResource<ProjectTeamScheduleData | null>(key, () =>
        loadTeamSchedule(uid, projectIds, keys),
      ).finally(() => {
        if (inFlight.current.get(key) === request) inFlight.current.delete(key);
      });
      inFlight.current.set(key, request);
      return request;
    },
    [loadTeamSchedule, projectIds, uid],
  );

  // Runs offline too: loadTeamJobs then reads the week from the persisted resource cache, which
  // is written as soon as it loads (the store snapshot may still be inside its write window).
  useEffect(() => {
    if (!uid || !projectsLoaded) return;
    let current = true;
    void loadTeamJobs(uid, startDate, endDate)
      .then(() => {
        if (!current) return;
        setJobsFailure(null);
        setLoadedJobsKey(jobsKey);
      })
      .catch((error: unknown) => {
        reportNetworkUnavailable(error);
        if (!current) return;
        setJobsFailure({ key: jobsKey, error: teamErrorMessage(error) });
        setLoadedJobsKey(jobsKey);
      });
    return () => {
      current = false;
    };
  }, [uid, online, projectsLoaded, startDate, endDate, jobsKey, loadTeamJobs, dataRefreshVersion]);

  useEffect(() => {
    if (!uid || !projectsLoaded) return;
    let current = true;
    const keys = dateKeysKey.split('|');
    void loadScheduleResource(resourceKey, keys, true)
      .then((data) => {
        if (!current) return;
        if (data) {
          setScheduleData(data);
          setMemoryResource(lastScheduleKey(uid), { dateKeys: keys, data });
        }
        setScheduleFailure(null);
        setLoadedScheduleKey(scheduleKey);
      })
      .catch((error: unknown) => {
        reportNetworkUnavailable(error);
        if (!current) return;
        setScheduleFailure({ key: scheduleKey, error: teamErrorMessage(error) });
        setLoadedScheduleKey(scheduleKey);
      });
    return () => {
      current = false;
    };
  }, [
    uid,
    projectsLoaded,
    dateKeysKey,
    loadScheduleResource,
    resourceKey,
    scheduleKey,
    dataRefreshVersion,
  ]);

  // Prefetch the previous and next weeks so swiping shows them immediately.
  useEffect(() => {
    if (!uid || !projectsLoaded || !online || projectIds.length === 0) return;
    const weekStart = startOfWeek(dateFromKey(dateKeysKey.split('|')[0]!));
    for (const offset of [-1, 1]) {
      const adjacentDateKeys = getWeekDateKeys(shiftWeeks(weekStart, offset));
      const adjacentKey = scheduleResourceKey(uid, projectIdsKey, adjacentDateKeys);
      if (
        getMemoryResource<ProjectTeamScheduleData>(adjacentKey) !== undefined ||
        inFlight.current.has(adjacentKey)
      )
        continue;
      void loadScheduleResource(adjacentKey, adjacentDateKeys, false).catch(() => {
        // Navigation keeps its own read and shows the error only if that week is opened.
      });
    }
  }, [
    uid,
    projectsLoaded,
    online,
    projectIds,
    projectIdsKey,
    dateKeysKey,
    dataRefreshVersion,
    loadScheduleResource,
  ]);

  const replaceSchedule = (
    update: (current: ProjectTeamScheduleData) => ProjectTeamScheduleData,
  ) => {
    const current = getMemoryResource<ProjectTeamScheduleData>(resourceKey) ?? scheduleData;
    const next = update(current);
    setScheduleData(next);
    setMemoryResource(resourceKey, next);
    if (uid) setMemoryResource(lastScheduleKey(uid), { dateKeys, data: next });
  };

  const saveDay = async (projectId: string, dateKey: DateKey, assignments: ProjectAssignment[]) => {
    const override = await saveDailyAssignments(projectId, dateKey, assignments);
    if (!override) return;
    replaceSchedule((current) => ({
      ...current,
      overridesByProjectDate: {
        ...current.overridesByProjectDate,
        [`${projectId}:${dateKey}`]: override,
      },
    }));
  };

  const resetDay = async (projectId: string, dateKey: DateKey) => {
    await removeDailyAssignmentOverride(projectId, dateKey);
    replaceSchedule((current) => {
      const overrides = { ...current.overridesByProjectDate };
      delete overrides[`${projectId}:${dateKey}`];
      return { ...current, overridesByProjectDate: overrides };
    });
  };

  const visible = cachedSchedule ?? scheduleData;
  return {
    projects,
    teamJobs,
    assignmentsByProjectId: visible.assignmentsByProjectId,
    overridesByProjectDate: visible.overridesByProjectDate,
    loading: scheduleLoading || jobsLoading,
    error:
      scheduleError ||
      jobsError ||
      (jobsUnavailable ? TEAM_COPY.weekJobsUnavailable : '') ||
      (scheduleUnavailable ? TEAM_COPY.weekScheduleUnavailable : ''),
    retry: () => {
      setScheduleAttempt((attempt) => attempt + 1);
      setJobsAttempt((attempt) => attempt + 1);
    },
    saveDay,
    resetDay,
  };
}
