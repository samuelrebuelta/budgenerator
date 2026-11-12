import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { useProjectStore, type DailyAssignmentResourceFilter } from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import { dateFromKey, isDateKey, startOfWeek } from '@/shared/lib';
import { getMemoryResource } from '@/shared/lib/memoryResourceCache';
import { reportNetworkUnavailable, useNetworkStore } from '@/shared/model/network';
import { lastScheduleKey, type LastTeamSchedule } from './model/useTeamSchedule';
import { TeamContext, type TeamContextValue } from './model/teamContext';
import { teamErrorMessage } from './model/teamErrors';
import { weekdayIndex } from './model/schedule';

/**
 * Route layout of `/team`, `/team/manage` and `/team/jobs/new`. It loads the roster and the
 * project list once for the three routes and keeps the calendar view while moving between them.
 */
export function TeamLayout() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const rawDate = searchParams.get('date');
  const queryDateKey = isDateKey(rawDate) ? rawDate : undefined;
  const uid = useAuthStore((state) => state.user?.uid);
  const online = useNetworkStore((state) => state.online);
  const browserOnline = useNetworkStore((state) => state.browserOnline);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const workforceLoaded = useWorkforceStore((state) => state.loaded);
  const loadWorkforce = useWorkforceStore((state) => state.loadWorkforce);
  const projectsLoaded = useProjectStore((state) => state.loaded);
  const loadProjects = useProjectStore((state) => state.loadProjects);

  const [week, setWeekState] = useState(() => {
    const lastSchedule = uid
      ? getMemoryResource<LastTeamSchedule>(lastScheduleKey(uid))
      : undefined;
    const anchor = queryDateKey
      ? dateFromKey(queryDateKey)
      : !online && lastSchedule
        ? dateFromKey(lastSchedule.dateKeys[0]!)
        : new Date();
    return {
      weekStart: startOfWeek(anchor),
      selectedDayIndex: weekdayIndex(queryDateKey ? dateFromKey(queryDateKey) : new Date()),
    };
  });
  const [selectedResources, setSelectedResources] = useState<DailyAssignmentResourceFilter[]>([]);
  // `/team?date=…` (after creating a job or from a link) opens that week and day.
  const [appliedFocusKey, setAppliedFocusKey] = useState(queryDateKey);
  const focusKey = pathname === '/team' ? queryDateKey : undefined;
  if (focusKey !== appliedFocusKey) {
    setAppliedFocusKey(focusKey);
    if (focusKey) {
      const focusDate = dateFromKey(focusKey);
      setWeekState({
        weekStart: startOfWeek(focusDate),
        selectedDayIndex: weekdayIndex(focusDate),
      });
    }
  }

  const [loadAttempt, setLoadAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; error: string } | null>(null);
  const loadKey = `${uid ?? ''}:${loadAttempt}`;
  const error = failure?.key === loadKey ? failure.error : '';

  useEffect(() => {
    if (!uid) return;
    if (!browserOnline && (!workforceLoaded || !projectsLoaded)) return;
    let current = true;
    void Promise.all([loadWorkforce(uid), loadProjects(uid)]).catch((reason: unknown) => {
      reportNetworkUnavailable(reason);
      if (current) setFailure({ key: loadKey, error: teamErrorMessage(reason) });
    });
    return () => {
      current = false;
    };
  }, [
    uid,
    loadKey,
    loadWorkforce,
    loadProjects,
    browserOnline,
    workforceLoaded,
    projectsLoaded,
    dataRefreshVersion,
  ]);

  const ready = workforceLoaded && projectsLoaded;
  const value = useMemo<TeamContextValue>(
    () => ({
      queryDateKey,
      view: {
        weekStart: week.weekStart,
        selectedDayIndex: week.selectedDayIndex,
        selectedResources,
        setWeek: (weekStart, selectedDayIndex) =>
          setWeekState((current) => ({
            weekStart,
            selectedDayIndex: selectedDayIndex ?? current.selectedDayIndex,
          })),
        setSelectedDayIndex: (selectedDayIndex) =>
          setWeekState((current) => ({ ...current, selectedDayIndex })),
        setSelectedResources,
      },
      data: {
        uid,
        ready,
        unavailable: !ready && !online,
        error,
        retry: () => setLoadAttempt((attempt) => attempt + 1),
        reportError: (reason) => setFailure({ key: loadKey, error: teamErrorMessage(reason) }),
        clearError: () => setFailure(null),
      },
    }),
    [queryDateKey, week, selectedResources, uid, ready, online, error, loadKey],
  );

  return (
    <TeamContext.Provider value={value}>
      <Outlet />
    </TeamContext.Provider>
  );
}
