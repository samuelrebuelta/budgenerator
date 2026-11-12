import { ArrowRight, FolderOpen, UsersRound } from 'lucide-react';
import { ProjectProgressBar, ProjectStatusTag, useProjectStore } from '@/entities/project';
import { formatCurrency } from '@/shared/lib';
import { Button, PageHeader, PageLink, Skeleton } from '@/shared/ui';
import { OfflineUnavailable } from '@/shared/ui/OfflineUnavailable';
import { useNetworkStore } from '@/shared/model/network';
import { usePageNavigation } from '@/shared/ui/page-view-transition';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ProjectsPage() {
  const { navigate } = usePageNavigation();
  const projects = useProjectStore((state) => state.projects);
  const loaded = useProjectStore((state) => state.loaded);
  const online = useNetworkStore((state) => state.online);

  return (
    <div className="page-container">
      <PageHeader
        title="Proyectos"
        description="Sigue el avance estimado de las reformas que ya han empezado."
        actions={
          <div className="flex flex-wrap gap-2">
            <PageLink
              to="/team"
              className="ui-button inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink-strong hover:bg-brand-50"
            >
              <UsersRound size={17} aria-hidden="true" />
              Equipo
            </PageLink>
          </div>
        }
      />

      {!loaded && projects.length === 0 && online ? (
        <div className="space-y-3" role="status" aria-label="Cargando proyectos">
          <span className="sr-only">Cargando proyectos</span>
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-xl bg-white p-5">
              <Skeleton className="mb-3 h-5 w-52 max-w-full" />
              <Skeleton className="mb-5 h-4 w-72 max-w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : !loaded && projects.length === 0 ? (
        <OfflineUnavailable />
      ) : projects.length === 0 ? (
        <section
          className="rounded-xl bg-canvas px-6 py-10 sm:px-10"
          aria-labelledby="empty-projects"
        >
          <FolderOpen size={28} className="mb-5 text-ink-strong" aria-hidden="true" />
          <h2 id="empty-projects" className="mb-2 text-xl font-semibold text-ink">
            Aquí aparecerán tus proyectos
          </h2>
          <p className="mb-5 max-w-xl text-sm leading-6 text-ink-muted">
            Cuando un cliente acepte un presupuesto, conviértelo en proyecto para marcar los
            partidas terminadas y consultar el avance.
          </p>
          <Button variant="secondary" onClick={() => navigate('/budgets')}>
            Ver presupuestos
            <ArrowRight size={16} />
          </Button>
        </section>
      ) : (
        <section aria-label="Lista de proyectos" className="space-y-3">
          {projects.map((project) => (
            <PageLink
              key={project.id}
              to={`/projects/${project.id}`}
              className="block rounded-xl bg-white px-5 py-5 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="truncate text-base font-semibold text-ink">
                      {project.clientName || 'Cliente sin nombre'}
                    </h2>
                    <ProjectStatusTag status={project.status} />
                  </div>
                  <p className="truncate text-sm text-ink-muted">
                    {project.title || `Presupuesto ${project.sourceBudgetNumber}`}
                    {project.address && project.address !== project.title
                      ? ` · ${project.address}`
                      : ''}
                  </p>
                </div>
                <strong className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {project.percent}%
                </strong>
              </div>
              <div className="my-4">
                <ProjectProgressBar
                  percent={project.percent}
                  label={`Avance de ${project.title || project.clientName}: ${project.percent}%`}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>
                  {project.completedConcepts} de {project.totalConcepts} partidas ·{' '}
                  {project.mode === 'amount'
                    ? 'ponderado por importe previsto'
                    : 'por cantidad de partidas'}
                </span>
                <span>
                  Aceptado el {dateLabel(project.acceptedAt)} · Total actualizado{' '}
                  {formatCurrency(project.updatedTotal ?? project.total)}
                </span>
              </div>
            </PageLink>
          ))}
        </section>
      )}

      {loaded && projects.length > 0 && (
        <p className="mt-5 text-xs text-ink-subtle">
          El avance se estima con los importes o partidas del presupuesto; no mide horas ni
          porcentaje físico de obra.
        </p>
      )}
    </div>
  );
}
