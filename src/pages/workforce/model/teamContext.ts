import { createContext, useContext } from 'react';
import type { DailyAssignmentResourceFilter } from '@/entities/project';
import type { DateKey } from '@/shared/lib';

/**
 * Calendar view shared by the team routes. It lives in `TeamLayout`, so the visible week,
 * selected day and resource filter survive `/team` ⇄ `/team/manage` ⇄ `/team/jobs/new`
 * and reset when leaving the team section (docs/state-and-cache.md, BG-011).
 */
export interface TeamScheduleView {
  weekStart: Date;
  /** Monday = 0 … Sunday = 6. */
  selectedDayIndex: number;
  selectedResources: DailyAssignmentResourceFilter[];
  setWeek: (weekStart: Date, selectedDayIndex?: number) => void;
  setSelectedDayIndex: (index: number) => void;
  setSelectedResources: (resources: DailyAssignmentResourceFilter[]) => void;
}

/** Roster and project list loading shared by the three team routes. */
export interface TeamDataState {
  uid: string | undefined;
  /** Workforce and projects are available (loaded or restored offline). */
  ready: boolean;
  /** Offline without a local copy. */
  unavailable: boolean;
  error: string;
  retry: () => void;
  reportError: (error: unknown) => void;
  clearError: () => void;
}

export interface TeamContextValue {
  view: TeamScheduleView;
  data: TeamDataState;
  /** Date requested with `?date=YYYY-MM-DD`, if valid. */
  queryDateKey: DateKey | undefined;
}

export const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeamContext(): TeamContextValue {
  const context = useContext(TeamContext);
  if (!context) throw new Error('Las rutas de Equipo deben renderizarse dentro de TeamLayout.');
  return context;
}
