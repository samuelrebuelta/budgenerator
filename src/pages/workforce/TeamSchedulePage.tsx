import { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { getWeekDateKeys } from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import { useNetworkStore } from '@/shared/model/network';
import { IconButton } from '@/shared/ui';
import { usePageNavigation } from '@/shared/ui/page-view-transition';
import { WeeklyProjectSchedule } from './components/WeeklyProjectSchedule';
import { TeamPageFrame } from './components/TeamPageFrame';
import { TEAM_COPY } from './model/copy';
import { useTeamContext } from './model/teamContext';
import { useTeamSchedule } from './model/useTeamSchedule';

/** `/team`: weekly plan of projects and one-off jobs (BG-011). */
export function TeamSchedulePage() {
  const { view, data } = useTeamContext();
  const { navigate } = usePageNavigation();
  const online = useNetworkStore((state) => state.online);
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const dateKeys = useMemo(() => getWeekDateKeys(view.weekStart), [view.weekStart]);
  const schedule = useTeamSchedule(data.uid, dateKeys);

  return (
    <TeamPageFrame
      title={TEAM_COPY.scheduleTitle}
      description={TEAM_COPY.scheduleDescription}
      actions={
        <IconButton
          variant="secondary"
          label="Gestionar miembros y cuadrillas"
          icon={<Pencil size={18} aria-hidden="true" />}
          onClick={() => navigate('/team/manage')}
        />
      }
    >
      <section aria-label="Planificación semanal">
        <WeeklyProjectSchedule
          weekStart={view.weekStart}
          selectedDayIndex={view.selectedDayIndex}
          selectedResources={view.selectedResources}
          onWeekChange={view.setWeek}
          onSelectedDayChange={view.setSelectedDayIndex}
          onSelectedResourcesChange={view.setSelectedResources}
          projects={schedule.projects}
          assignmentsByProjectId={schedule.assignmentsByProjectId}
          overridesByProjectDate={schedule.overridesByProjectDate}
          members={members}
          crews={crews}
          teamJobs={schedule.teamJobs}
          offline={!online}
          loading={schedule.loading}
          error={schedule.error}
          onRetry={schedule.retry}
          onNewJob={(dateKey) => navigate(`/team/jobs/new?date=${dateKey}`)}
          onSave={schedule.saveDay}
          onReset={schedule.resetDay}
        />
      </section>
    </TeamPageFrame>
  );
}
