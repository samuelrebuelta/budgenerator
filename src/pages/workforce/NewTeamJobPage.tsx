import { useState } from 'react';
import { useProjectStore } from '@/entities/project';
import { useWorkforceStore } from '@/entities/workforce';
import { generateId, todayKey } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { usePageNavigation } from '@/shared/ui/page-view-transition';
import { NewTeamJobForm } from './components/NewTeamJobForm';
import { TeamPageFrame } from './components/TeamPageFrame';
import { TEAM_COPY } from './model/copy';
import { useTeamContext } from './model/teamContext';

/** `/team/jobs/new?date=YYYY-MM-DD`: one-off job with its own save action in the header. */
export function NewTeamJobPage() {
  const { queryDateKey } = useTeamContext();
  const { navigate } = usePageNavigation();
  const members = useWorkforceStore((state) => state.members);
  const crews = useWorkforceStore((state) => state.crews);
  const saveMember = useWorkforceStore((state) => state.saveMember);
  const createTeamJob = useWorkforceStore((state) => state.createTeamJob);
  const projects = useProjectStore((state) => state.projects);
  const [saving, setSaving] = useState(false);
  const [fallbackDate] = useState(todayKey);
  const date = queryDateKey ?? fallbackDate;
  const hasActiveResources =
    members.some((member) => member.status === 'active') ||
    crews.some((crew) => crew.status === 'active');

  return (
    <TeamPageFrame
      title={TEAM_COPY.newJobTitle}
      description={TEAM_COPY.newJobDescription}
      backTo={`/team?date=${date}`}
      actionsWhileLoading={false}
      actionsInWorkspaceHeader
      actions={
        <Button
          type="submit"
          form="team-job-form"
          className="shrink-0"
          aria-label="Guardar trabajo"
          loading={saving}
          disabled={!hasActiveResources}
        >
          Guardar
        </Button>
      }
    >
      <section aria-label="Nuevo trabajo">
        <NewTeamJobForm
          key={date}
          initialDate={date}
          members={members}
          crews={crews}
          projects={projects}
          onCreateMember={(name) => {
            const now = new Date().toISOString();
            return saveMember({
              id: generateId(),
              name,
              status: 'active',
              createdAt: now,
              updatedAt: now,
            });
          }}
          onSavingChange={setSaving}
          onSave={async (job) => {
            await createTeamJob(job);
            navigate(`/team?date=${job.date}`);
          }}
        />
      </section>
    </TeamPageFrame>
  );
}
