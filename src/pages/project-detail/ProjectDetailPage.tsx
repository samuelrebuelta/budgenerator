import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Circle, ClipboardCheck, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { getProjectLocalDateKey, ProjectStatusTag, useProjectStore } from '@/entities/project';
import type { ProjectWorkItem } from '@/entities/project';
import { formatCurrency, generateId } from '@/shared/lib';
import { money, taskAmount } from '@/shared/lib/budgetMath';
import { Button, Card, PageHeader, Skeleton } from '@/shared/ui';
import { ProjectProgressBar } from '@/pages/projects/ProjectProgressBar';
import { ProjectProgressHistoryDialog } from './ProjectProgressHistoryDialog';
import { ProjectTaskCompletionDate } from './ProjectTaskCompletionDate';

function dateLabel(value: string) {
  return new Date(`${getProjectLocalDateKey(value)}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function userFacingError(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback;
  const message = reason.message.toLocaleLowerCase('es');
  if (message.includes('offline') || message.includes('network') || message.includes('unavailable'))
    return 'No hay conexión con el servicio.';
  if (message.includes('permission') || message.includes('insufficient'))
    return 'No tienes acceso a este proyecto.';
  return reason.message;
}

function workItemProgress(item: ProjectWorkItem, mode: 'amount' | 'concepts') {
  const totalConcepts = item.tasks.length;
  const completed = item.tasks.filter((task) => task.completedAt);
  const completedConcepts = completed.length;
  const totalAmount = money(item.tasks.reduce((total, task) => total + taskAmount(task), 0));
  const completedAmount = money(completed.reduce((total, task) => total + taskAmount(task), 0));
  const percent =
    totalConcepts === 0
      ? 0
      : Math.round(
          mode === 'amount' && totalAmount > 0
            ? (completedAmount / totalAmount) * 100
            : (completedConcepts / totalConcepts) * 100,
        );
  return {
    totalConcepts,
    completedConcepts,
    totalAmount,
    completedAmount,
    percent: Math.max(0, Math.min(100, percent)),
  };
}

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const uid = useAuthStore((state) => state.user?.uid);
  const activeProject = useProjectStore((state) => state.activeProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const toggleTask = useProjectStore((state) => state.toggleTask);
  const completeWorkItem = useProjectStore((state) => state.completeWorkItem);
  const setTaskCompletionDate = useProjectStore((state) => state.setTaskCompletionDate);
  const setWorkItemCompletionDate = useProjectStore((state) => state.setWorkItemCompletionDate);
  const addSupplement = useProjectStore((state) => state.addSupplement);
  const voidSupplement = useProjectStore((state) => state.voidSupplement);
  const [loadResult, setLoadResult] = useState<{
    key: string;
    missing: boolean;
    error: string;
  }>({ key: '', missing: false, error: '' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [supplementDescription, setSupplementDescription] = useState('');
  const [supplementQuantity, setSupplementQuantity] = useState('1');
  const [supplementUnit, setSupplementUnit] = useState('unit');
  const [supplementUnitPrice, setSupplementUnitPrice] = useState('');
  const [supplementRequestId, setSupplementRequestId] = useState<string | null>(null);
  const [supplementFormOpen, setSupplementFormOpen] = useState(false);
  const [voidingSupplementId, setVoidingSupplementId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [progressHistoryOpen, setProgressHistoryOpen] = useState(false);
  const requestKey = `${uid ?? ''}:${projectId}`;
  const loading = Boolean(uid && projectId && loadResult.key !== requestKey);
  const missing = loadResult.key === requestKey && loadResult.missing;
  const error = loadResult.key === requestKey ? loadResult.error : '';

  useEffect(() => {
    if (!uid || !projectId) return;
    let current = true;
    void loadProject(uid, projectId)
      .then((result) => {
        if (current) setLoadResult({ key: requestKey, missing: !result, error: '' });
      })
      .catch((reason: unknown) => {
        if (current) {
          setLoadResult({
            key: requestKey,
            missing: false,
            error: userFacingError(
              reason,
              'No se ha podido cargar el proyecto. Vuelve a intentarlo.',
            ),
          });
        }
      });
    return () => {
      current = false;
    };
  }, [uid, projectId, loadProject, requestKey, loadAttempt]);

  const project = activeProject?.id === projectId ? activeProject : null;

  const closeSupplementForm = () => {
    setSupplementFormOpen(false);
    setSupplementDescription('');
    setSupplementQuantity('1');
    setSupplementUnit('unit');
    setSupplementUnitPrice('');
    setSupplementRequestId(null);
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setActionError('');
    try {
      await action();
    } catch (reason) {
      setActionError(userFacingError(reason, 'No se ha podido actualizar el avance.'));
    } finally {
      setBusy(null);
    }
  };

  const retryLoad = () => {
    setActionError('');
    setLoadResult({ key: '', missing: false, error: '' });
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-label="Cargando proyecto">
        <Skeleton className="mb-5 h-9 w-64 max-w-full" />
        <Skeleton className="mb-8 h-4 w-80 max-w-full" />
        <Skeleton className="mb-4 h-32 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <PageHeader
          title="No se ha podido cargar el proyecto"
          description="Comprueba la conexión y vuelve a intentarlo."
          backTo="/projects"
          backLabel="Volver a proyectos"
        />
        <p className="field-error mb-4" role="alert">
          {error}
        </p>
        <Button variant="secondary" onClick={retryLoad}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (missing || !project) {
    return (
      <div className="page-container">
        <PageHeader
          title="Proyecto no disponible"
          description="No hemos encontrado este proyecto."
          backTo="/projects"
          backLabel="Volver a proyectos"
        />
        {(error || actionError) && (
          <p className="field-error" role="alert">
            {error || actionError}
          </p>
        )}
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Volver a proyectos
        </Button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title={project.title || `Presupuesto ${project.sourceBudgetNumber}`}
        description={`${project.clientName || 'Cliente sin nombre'}${project.address && project.address !== project.title ? ` · ${project.address}` : ''}`}
        backTo="/projects"
        backLabel="Volver a proyectos"
      />

      {(error || actionError) && (
        <p className="field-error mb-4" role="alert">
          {error || actionError}
        </p>
      )}

      <section
        data-project-summary
        aria-labelledby="project-summary-title"
        className="mb-8 rounded-2xl border border-[#c6d4cc] bg-[#eaf1ed] p-5 sm:p-7"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="project-summary-title" className="text-lg font-semibold text-[#1f2b26]">
              Avance estimado
            </h2>
            <p className="mt-1 text-sm text-[#52625a]">
              {project.completedConcepts} de {project.totalConcepts} conceptos terminados
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              className="h-11 justify-center gap-2 rounded-full border-[#bfd0c8] bg-[#edf4ef] px-4 text-[#1f5d56] shadow-sm hover:bg-[#e0eee6]"
              title="Ver progreso del proyecto"
              aria-haspopup="dialog"
              aria-expanded={progressHistoryOpen}
              onClick={() => setProgressHistoryOpen(true)}
            >
              <TrendingUp size={17} aria-hidden="true" />
              <span>Ver progreso</span>
            </Button>
            <ProjectStatusTag status={project.status} />
            <strong className="text-3xl font-semibold tabular-nums text-[#183e3b]">
              {project.percent}%
            </strong>
          </div>
        </div>
        <ProjectProgressBar
          percent={project.percent}
          label={`Avance del proyecto: ${project.percent}%`}
        />
        <p className="mt-3 text-xs leading-5 text-[#637166]">
          {project.mode === 'amount'
            ? `Ponderado por el importe neto previsto: ${formatCurrency(project.completedAmount)} de ${formatCurrency(project.totalAmount)}. No incluye IVA ni ajuste global.`
            : 'Calculado por conceptos porque no todos los importes permiten una ponderación fiable.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#52625a]">
          <span>Aceptado el {dateLabel(project.acceptedAt)}</span>
          <span>Proyecto creado el {dateLabel(project.createdAt)}</span>
          <span>Presupuesto {project.sourceBudgetNumber}</span>
        </div>
        <dl className="mt-5 grid gap-3 border-t border-[#c6d4cc] pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-[#52625a]">Total aceptado · IVA incluido</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-[#1f2b26]">
              {formatCurrency(project.total)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#52625a]">
              Suplementos activos · IVA incluido
            </dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-[#1f2b26]">
              {formatCurrency((project.supplementsSubtotal ?? 0) + (project.supplementsIva ?? 0))}
            </dd>
            <dd className="text-xs text-[#52625a]">
              Neto {formatCurrency(project.supplementsSubtotal ?? 0)} · IVA{' '}
              {formatCurrency(project.supplementsIva ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#52625a]">Total actualizado</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-[#183e3b]">
              {formatCurrency(project.updatedTotal ?? project.total)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="supplements-title"
        className="mb-8 rounded-2xl border border-[#d7dbd2] bg-white p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="supplements-title" className="text-lg font-semibold text-[#1f2b26]">
              Ampliaciones
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#52625a]">
              Añade aquí trabajos imprevistos. El presupuesto aceptado se conserva como referencia y
              cada ampliación queda registrada con su importe e IVA.
            </p>
          </div>
          {!supplementFormOpen && (
            <Button type="button" variant="secondary" onClick={() => setSupplementFormOpen(true)}>
              Nueva ampliación
            </Button>
          )}
        </div>

        {supplementFormOpen && (
          <form
            className="grid gap-3 rounded-xl bg-[#f6f6f0] p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const requestId = supplementRequestId ?? generateId();
              setSupplementRequestId(requestId);
              void run('supplement:add', async () => {
                await addSupplement(project.id, requestId, {
                  description: supplementDescription,
                  quantity: Number(supplementQuantity),
                  unit: supplementUnit,
                  unitPrice: Number(supplementUnitPrice),
                });
                closeSupplementForm();
              });
            }}
          >
            <label className="block text-xs font-semibold text-[#37443d] sm:col-span-2">
              Concepto imprevisto
              <input
                className="mt-1.5 min-h-11 w-full rounded-lg border border-[#c9cfc7] bg-white px-3 py-2 text-sm font-normal text-[#1f2b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                value={supplementDescription}
                onChange={(event) => setSupplementDescription(event.target.value)}
                maxLength={300}
                required
              />
            </label>
            <label className="block text-xs font-semibold text-[#37443d]">
              Cantidad
              <input
                className="mt-1.5 min-h-11 w-full rounded-lg border border-[#c9cfc7] bg-white px-3 py-2 text-sm font-normal text-[#1f2b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                type="number"
                min="0.001"
                step="any"
                value={supplementQuantity}
                onChange={(event) => setSupplementQuantity(event.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-semibold text-[#37443d]">
              Unidad
              <select
                className="mt-1.5 min-h-11 w-full rounded-lg border border-[#c9cfc7] bg-white px-3 py-2 text-sm font-normal text-[#1f2b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                value={supplementUnit}
                onChange={(event) => setSupplementUnit(event.target.value)}
              >
                <option value="unit">Ud.</option>
                <option value="m2">m²</option>
                <option value="m3">m³</option>
                <option value="ml">ml</option>
                <option value="hour">h</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#37443d] sm:col-span-2">
              Precio unitario sin IVA
              <input
                className="mt-1.5 min-h-11 w-full rounded-lg border border-[#c9cfc7] bg-white px-3 py-2 text-sm font-normal text-[#1f2b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                type="number"
                min="0.01"
                step="0.01"
                value={supplementUnitPrice}
                onChange={(event) => setSupplementUnitPrice(event.target.value)}
                required
              />
            </label>
            <p className="text-xs leading-5 text-[#52625a] sm:col-span-2">
              Se aplica el IVA del presupuesto aceptado. El precio no vuelve a recibir el ajuste
              global del presupuesto.
            </p>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={!!busy} loading={busy === 'supplement:add'}>
                Guardar ampliación
              </Button>
              <Button type="button" variant="ghost" disabled={!!busy} onClick={closeSupplementForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {project.supplements.length === 0 ? (
          <p className="mt-4 text-sm text-[#637166]">Todavía no hay ampliaciones registradas.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#ecece4]" aria-label="Historial de ampliaciones">
            {project.supplements.map((supplement) => {
              const supplementVoid = project.supplementVoids.find(
                (entry) => entry.supplementId === supplement.id,
              );
              return (
                <li key={supplement.id} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#1f2b26]">
                        {supplement.description}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#52625a]">
                        {supplement.quantity} {supplement.unit} ×{' '}
                        {formatCurrency(supplement.unitPrice)} · Añadido el{' '}
                        {dateLabel(supplement.createdAt)}
                      </p>
                      {supplementVoid && (
                        <p className="mt-2 text-xs leading-5 text-[#83452f]">
                          Anulado el {dateLabel(supplementVoid.voidedAt)} · {supplementVoid.reason}
                        </p>
                      )}
                    </div>
                    <strong className="shrink-0 text-sm tabular-nums text-[#183e3b]">
                      {formatCurrency(supplement.total)}
                    </strong>
                  </div>
                  {!supplementVoid && (
                    <div className="mt-3">
                      {voidingSupplementId === supplement.id ? (
                        <form
                          className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(`supplement:void:${supplement.id}`, async () => {
                              await voidSupplement(project.id, supplement.id, voidReason);
                              setVoidingSupplementId(null);
                              setVoidReason('');
                            });
                          }}
                        >
                          <label className="block text-xs font-semibold text-[#37443d]">
                            Motivo de anulación
                            <input
                              className="mt-1.5 min-h-11 w-full rounded-lg border border-[#c9cfc7] bg-white px-3 py-2 text-sm font-normal text-[#1f2b26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                              value={voidReason}
                              onChange={(event) => setVoidReason(event.target.value)}
                              maxLength={500}
                              required
                            />
                          </label>
                          <Button
                            type="submit"
                            variant="secondary"
                            disabled={!!busy}
                            loading={busy === `supplement:void:${supplement.id}`}
                          >
                            Confirmar anulación
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={!!busy}
                            onClick={() => {
                              setVoidingSupplementId(null);
                              setVoidReason('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() => setVoidingSupplementId(supplement.id)}
                        >
                          Anular ampliación
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-project-work-items aria-labelledby="work-items-title" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="work-items-title" className="text-lg font-semibold text-[#1f2b26]">
              Partidas de trabajo
            </h2>
            <p className="mt-1 text-sm text-[#52625a]">
              Marca cada concepto cuando esté terminado.
            </p>
          </div>
        </div>

        {project.workItems
          .filter((item) => !item.voidedAt)
          .map((item) => {
            const progress = workItemProgress(item, project.mode);
            const allComplete =
              progress.totalConcepts > 0 && progress.completedConcepts === progress.totalConcepts;
            return (
              <Card key={item.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#1f2b26]">{item.name}</h3>
                    <p className="mt-1 text-sm text-[#52625a]">
                      {progress.completedConcepts} de {progress.totalConcepts} conceptos ·{' '}
                      {progress.percent}%
                    </p>
                    {allComplete && item.tasks[0]?.completedAt && (
                      <div className="mt-2">
                        <ProjectTaskCompletionDate
                          subject={`la partida ${item.name}`}
                          completedAt={item.tasks[0].completedAt}
                          disabled={!!busy}
                          loading={busy === `date:work:${item.id}`}
                          onChange={(date) =>
                            void run(`date:work:${item.id}`, () =>
                              setWorkItemCompletionDate(project.id, item.id, date),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={allComplete || busy === `work:${item.id}`}
                    loading={busy === `work:${item.id}`}
                    onClick={() =>
                      void run(`work:${item.id}`, () => completeWorkItem(project.id, item.id))
                    }
                  >
                    <ClipboardCheck size={16} />
                    {allComplete ? 'Partida completada' : 'Completar partida'}
                  </Button>
                </div>
                <div className="my-4">
                  <ProjectProgressBar
                    percent={progress.percent}
                    label={`Avance de la partida ${item.name}: ${progress.percent}%`}
                  />
                </div>
                <ul className="divide-y divide-[#ecece4]">
                  {item.tasks.map((task) => {
                    const key = `${item.id}:${task.id}`;
                    const completed = !!task.completedAt;
                    return (
                      <li
                        key={task.id}
                        className="flex items-start justify-between gap-4 py-3 first:pt-1 last:pb-1"
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm ${completed ? 'text-[#52625a]' : 'text-[#1f2b26]'}`}
                          >
                            {task.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <p className="text-xs text-[#637166]">
                              {task.quantity} {task.unit} · {formatCurrency(taskAmount(task))}
                            </p>
                            {completed && task.completedAt && (
                              <ProjectTaskCompletionDate
                                subject={`el concepto ${task.description}`}
                                completedAt={task.completedAt}
                                disabled={!!busy}
                                loading={busy === `date:task:${key}`}
                                onChange={(date) =>
                                  void run(`date:task:${key}`, () =>
                                    setTaskCompletionDate(project.id, item.id, task.id, date),
                                  )
                                }
                              />
                            )}
                          </div>
                        </div>
                        <Button
                          variant={completed ? 'secondary' : 'ghost'}
                          className="shrink-0"
                          disabled={!!busy}
                          loading={busy === key}
                          aria-pressed={completed}
                          aria-label={`${completed ? 'Reabrir' : 'Marcar como terminado'}: ${task.description}`}
                          onClick={() =>
                            void run(key, () => toggleTask(project.id, item.id, task.id))
                          }
                        >
                          {completed ? <Check size={16} /> : <Circle size={16} />}
                          {completed ? 'Terminado' : 'Pendiente'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
      </section>
      <ProjectProgressHistoryDialog
        open={progressHistoryOpen}
        onClose={() => setProgressHistoryOpen(false)}
        workItems={project.workItems}
        mode={project.mode}
      />
    </div>
  );
}
