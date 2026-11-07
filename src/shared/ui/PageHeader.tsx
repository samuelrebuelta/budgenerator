import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageLink } from './PageLink';
import { Skeleton } from './Skeleton';
import { PageHeaderAccessoryContext } from './PageHeaderAccessoryContext';
import { resolvePageBackPath } from './page-view-transition';

export function BackButton({ to, label }: { to: string; label: string }) {
  const { state } = useLocation();
  const resolvedTo = resolvePageBackPath(to, state);
  const tabLabels: Record<string, string> = {
    '/budgets': 'presupuestos',
    '/projects': 'proyectos',
    '/team': 'equipo',
    '/profile/solicitudes': 'solicitudes',
    '/': 'proyectos',
  };
  const resolvedLabel = resolvedTo === to ? label : `Volver a ${tabLabels[resolvedTo]}`;

  return (
    <PageLink
      to={resolvedTo}
      back
      className="back-button"
      aria-label={resolvedLabel}
      data-page-transition-back
    >
      <ChevronLeft size={21} aria-hidden="true" />
    </PageLink>
  );
}

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  actionsInWorkspaceHeader?: boolean;
  descriptionAndActionsBelowTitle?: boolean;
  backTo?: string;
  backLabel?: string;
}
export function PageHeader({
  title,
  description,
  actions,
  actionsInWorkspaceHeader = false,
  descriptionAndActionsBelowTitle = false,
  backTo,
  backLabel = 'Volver a la página anterior',
}: PageHeaderProps) {
  const { accessory, mobileBackTarget, workspaceHeaderActionTarget } = useContext(
    PageHeaderAccessoryContext,
  );
  const workspaceHeaderActions =
    actionsInWorkspaceHeader && actions && workspaceHeaderActionTarget
      ? createPortal(actions, workspaceHeaderActionTarget)
      : null;

  return (
    <>
      <header
        className="page-heading unified-page-header no-print"
        data-page-header
        data-has-back={!!backTo}
        data-actions-below-title={descriptionAndActionsBelowTitle}
      >
        {backTo && <BackButton to={backTo} label={backLabel} />}
        <div className="page-heading-identity">
          <div className="page-heading-copy">
            <h1>{title}</h1>
            {!descriptionAndActionsBelowTitle && <p>{description}</p>}
          </div>
        </div>
        {backTo && accessory && <div className="page-heading-menu-action">{accessory}</div>}
        {descriptionAndActionsBelowTitle ? (
          <div className="page-heading-meta">
            <p>{description}</p>
            {!actionsInWorkspaceHeader && actions && (
              <div className="page-heading-actions">{actions}</div>
            )}
          </div>
        ) : (
          !actionsInWorkspaceHeader &&
          actions && <div className="page-heading-actions">{actions}</div>
        )}
      </header>
      {workspaceHeaderActions}
      {backTo && mobileBackTarget
        ? createPortal(<BackButton to={backTo} label={backLabel} />, mobileBackTarget)
        : null}
    </>
  );
}
export function PageHeaderSkeleton({
  backTo,
  backLabel = 'Volver a la página anterior',
}: {
  backTo?: string;
  backLabel?: string;
} = {}) {
  const { accessory, mobileBackTarget } = useContext(PageHeaderAccessoryContext);

  return (
    <>
      <div
        className={`page-heading header-skeleton${backTo ? ' unified-page-header' : ''}`}
        data-has-back={!!backTo}
      >
        {backTo && <BackButton to={backTo} label={backLabel} />}
        <div className="page-heading-skeleton-copy" aria-hidden="true">
          <Skeleton className="mb-3 h-9 w-60 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        {backTo && accessory && <div className="page-heading-menu-action">{accessory}</div>}
      </div>
      {backTo && mobileBackTarget
        ? createPortal(<BackButton to={backTo} label={backLabel} />, mobileBackTarget)
        : null}
    </>
  );
}
