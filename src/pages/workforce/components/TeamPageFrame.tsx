import type { ReactNode } from 'react';
import { Alert, Button, OfflineUnavailable, PageHeader } from '@/shared/ui';
import { TEAM_COPY } from '../model/copy';
import { useTeamContext } from '../model/teamContext';

interface TeamPageFrameProps {
  title: string;
  description: string;
  actions?: ReactNode;
  /** Shows the actions while the roster loads (they do not depend on it). */
  actionsWhileLoading?: boolean;
  actionsInWorkspaceHeader?: boolean;
  descriptionAndActionsBelowTitle?: boolean;
  backTo?: string;
  children: ReactNode;
}

/** Header plus the offline, loading and error states shared by the team routes. */
export function TeamPageFrame({
  title,
  description,
  actions,
  actionsWhileLoading = true,
  actionsInWorkspaceHeader = false,
  descriptionAndActionsBelowTitle = false,
  backTo,
  children,
}: TeamPageFrameProps) {
  const { data } = useTeamContext();
  const header = (ready: boolean) => (
    <PageHeader
      title={title}
      description={description}
      actions={ready || actionsWhileLoading ? actions : undefined}
      actionsInWorkspaceHeader={ready && actionsInWorkspaceHeader}
      descriptionAndActionsBelowTitle={descriptionAndActionsBelowTitle}
      backTo={backTo}
      backLabel={TEAM_COPY.backLabel}
    />
  );

  if (data.unavailable)
    return (
      <div className="page-container">
        {header(false)}
        <OfflineUnavailable />
      </div>
    );

  if (!data.ready && !data.error)
    return (
      <div className="page-container" role="status" aria-label="Cargando equipo">
        {header(false)}
        <div className="h-36 animate-pulse rounded-xl bg-surface/70" />
      </div>
    );

  return (
    <div className="page-container">
      {header(true)}
      {data.error && (
        <Alert
          tone="danger"
          className="mb-5"
          action={
            <Button variant="secondary" onClick={data.retry}>
              {TEAM_COPY.retry}
            </Button>
          }
        >
          {data.error}
        </Alert>
      )}
      {children}
    </div>
  );
}
