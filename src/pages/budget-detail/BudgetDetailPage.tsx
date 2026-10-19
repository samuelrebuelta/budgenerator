import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useBlocker, useLocation, Link } from 'react-router-dom';
import { BudgetStructureButton } from '@/features/budget-structure/BudgetStructureButton';
import { BudgetHeader } from './components/BudgetHeader';
import { BudgetEditor } from '@/features/budget-editor/ui/BudgetEditor';
import { BudgetSummary } from '@/features/budget-editor/ui/BudgetSummary';
import { AddWorkItemButton } from '@/features/budget-editor/ui/AddWorkItemButton';
import { ExportPdfButton } from '@/shared/ui';
import { ShareButton } from './components/ShareButton';
import { SaveTemplateButton } from './components/SaveTemplateButton';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { useCatalogStore } from '@/entities/catalog';
import { useProfileStore } from '@/entities/profile';
import { useUserStore } from '@/entities/user';
import { useAuthStore } from '@/entities/auth';
import {
  fetchLead,
  ESTIMATOR_QUALITIES,
  LEGACY_ESTIMATOR_QUALITIES,
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  LEAD_START_TIMINGS,
  type QuoteLead,
} from '@/entities/quote-estimator';
import { Button, Card, ConfirmModal, BudgetLimitReached, PageHeader } from '@/shared/ui';
import { BudgetSkeleton } from './components/BudgetSkeleton';
import {
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  FolderKanban,
} from 'lucide-react';
import { t } from '@/shared/i18n';
import { getBudgetSlotsUsed } from '@/shared/lib/utils';
import { useProjectStore } from '@/entities/project';

export function BudgetDetailPage() {
  const { budgetId = 'new' } = useParams<{ budgetId: string }>();
  return <BudgetDetailContent key={budgetId} budgetId={budgetId} />;
}
function BudgetDetailContent({ budgetId }: { budgetId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDraft = budgetId === 'new';
  const leadId = new URLSearchParams(location.search).get('leadId');
  const uid = useAuthStore((s) => s.user?.uid);
  const allowDraftNavigation = useRef(false);

  const setActiveBudget = useBudgetStore((s) => s.setActiveBudget);
  const startDraft = useBudgetStore((s) => s.startDraft);
  const startDraftFromLead = useBudgetStore((s) => s.startDraftFromLead);
  const savingDraft = useBudgetStore((s) => s.savingDraft);
  const [saveError, setSaveError] = useState('');
  const [leadContext, setLeadContext] = useState<QuoteLead | null | undefined>(
    leadId ? undefined : null,
  );
  const saveDraft = useBudgetStore((s) => s.saveDraft);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const startDraftFromBudget = useBudgetStore((s) => s.startDraftFromBudget);
  const acceptBudget = useBudgetStore((s) => s.acceptBudget);
  const withdrawBudgetAcceptance = useBudgetStore((s) => s.withdrawBudgetAcceptance);
  const linkProject = useBudgetStore((s) => s.linkProject);
  const convertBudgetToProject = useProjectStore((s) => s.convertBudgetToProject);
  const draftBudget = useBudgetStore((s) => s.draftBudget);
  const canCreateBudget = useUserStore((s) => s.canCreateBudget);
  const userData = useUserStore((s) => s.userData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const partidasKey = `collapsed-partidas-${budgetId ?? 'new'}`;
  const [showPartidas, setShowPartidas] = useState(() => {
    try {
      const stored = localStorage.getItem(partidasKey);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const togglePartidas = () =>
    setShowPartidas((prev) => {
      localStorage.setItem(partidasKey, String(!prev));
      return !prev;
    });
  const activeBudget = useActiveBudget();
  const activeCatalogId = useCatalogStore((s) => s.activeCatalogId);
  const profile = useProfileStore((s) => s.profile);
  const budgetExists = useBudgetStore((s) => s.budgets.some((b) => b.id === budgetId));
  const budgetsLoaded = useBudgetStore((s) => s.loaded);
  const readOnlySource = !!activeBudget?.acceptedAt || !!activeBudget?.projectId;

  // Initialize draft or set active budget
  useEffect(() => {
    if (isDraft) {
      if (leadId) {
        if (!uid) return;
        let active = true;
        fetchLead(uid, leadId)
          .then((lead) => {
            if (!active) return;
            setLeadContext(lead);
            if (lead) startDraftFromLead(lead, activeCatalogId ?? undefined);
          })
          .catch(() => {
            if (active) setLeadContext(null);
          });
        return () => {
          active = false;
        };
      }
      startDraft(activeCatalogId ?? undefined);
    } else if (budgetId) {
      setActiveBudget(budgetId);
    }
    return () => {
      if (!isDraft) setActiveBudget(null);
    };
  }, [
    budgetId,
    isDraft,
    setActiveBudget,
    startDraft,
    startDraftFromLead,
    activeCatalogId,
    leadId,
    uid,
  ]);

  // Block in-app navigation when draft has content
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false;
    if (allowDraftNavigation.current) {
      allowDraftNavigation.current = false;
      return false;
    }
    const draft = useBudgetStore.getState().draftBudget;
    if (!draft) return false;
    return draft.info.clientName !== '' || draft.info.address !== '' || draft.workItems.length > 0;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm(t('budget.unsavedChanges'));
      if (confirmed) {
        discardDraft();
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, discardDraft]);

  // Block browser close / refresh when draft has content
  useEffect(() => {
    if (!isDraft) return;
    const handler = (e: BeforeUnloadEvent) => {
      const draft = useBudgetStore.getState().draftBudget;
      if (
        draft &&
        (draft.info.clientName !== '' || draft.info.address !== '' || draft.workItems.length > 0)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDraft]);

  const handleSave = async () => {
    setSaveError('');
    try {
      const id = await saveDraft();
      if (id) navigate(`/budget/${id}`, { replace: true });
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : 'No se ha podido guardar. Vuelve a intentarlo.',
      );
    }
  };

  const handleDiscard = () => {
    discardDraft();
    navigate('/');
  };

  // Redirect if budget doesn't exist (only after data loaded)
  useEffect(() => {
    if (!isDraft && budgetId && budgetsLoaded && !budgetExists) {
      navigate('/', { replace: true });
    }
  }, [isDraft, budgetId, budgetExists, budgetsLoaded, navigate]);

  if (!isDraft && !budgetsLoaded) {
    return <BudgetSkeleton />;
  }
  if (!isDraft && !budgetExists) return null;

  if (isDraft && !canCreateBudget()) {
    return (
      <div className="page-container">
        <PageHeader
          title="Nuevo presupuesto"
          description="Consulta las condiciones de tu plan antes de crear otro presupuesto."
          backTo="/budgets"
          backLabel="Volver a presupuestos"
        />
        <div className="w-full max-w-sm">
          <BudgetLimitReached
            budgetSlotsUsed={getBudgetSlotsUsed(userData?.totalBudgetsCreated ?? 0)}
          />
        </div>
      </div>
    );
  }

  if (isDraft && leadId && leadContext === undefined) return <BudgetSkeleton />;

  if (isDraft && leadId && leadContext === null) {
    return (
      <div className="page-container">
        <PageHeader
          title="Solicitud no disponible"
          description="No se ha podido abrir el contexto de origen de este borrador."
          backTo="/profile/solicitudes"
          backLabel="Volver a solicitudes"
        />
        <p className="mt-4 text-sm text-gray-600">
          No se ha encontrado la solicitud. Puede que se haya borrado o que ya no tengas acceso.
        </p>
      </div>
    );
  }

  if (isDraft && !draftBudget) return null;

  return (
    <div className="page-container budget-document">
      <div className="budget-document-content print:p-[10mm]">
        <PageHeader
          title={isDraft ? 'Nuevo presupuesto' : 'Presupuesto'}
          description={
            readOnlySource
              ? 'Este presupuesto se conserva como referencia de la oferta aceptada.'
              : 'Define los capítulos y sus partidas, revisa los importes y completa los datos del cliente.'
          }
          backTo="/budgets"
          backLabel="Volver a presupuestos"
        />

        {isDraft && (
          <div className="draft-banner mb-4 w-full rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 no-print">
            {t('budget.draftBanner')} <strong>{t('budget.draftBannerBold')}</strong>.
          </div>
        )}

        {/* Page Card */}
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        {activeBudget?.projectId && (
          <div
            className="mb-4 rounded-xl bg-[#e8eee3] px-4 py-4 text-sm text-[#183e3b]"
            role="status"
          >
            <p className="font-semibold">Presupuesto convertido en proyecto</p>
            <p className="mt-1">La oferta aceptada permanece aquí como documento de referencia.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#183e3b] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7694d]"
                to={`/projects/${activeBudget.projectId}`}
              >
                <FolderKanban size={16} />
                Abrir proyecto
              </Link>
            </div>
          </div>
        )}
        {activeBudget?.acceptedAt && !activeBudget.projectId && (
          <div
            className="mb-4 rounded-xl bg-[#f2f2e9] px-4 py-4 text-sm text-[#36473e]"
            role="status"
          >
            <p className="font-semibold">
              Presupuesto aceptado el{' '}
              {new Date(activeBudget.acceptedAt).toLocaleDateString('es-ES')}.
            </p>
            <p className="mt-1">Puedes retirarlo para volver a editar o convertirlo en proyecto.</p>
          </div>
        )}
        <Card className="p-4 sm:p-8 print:shadow-none print:border-none print:rounded-none">
          <fieldset disabled={savingDraft || readOnlySource} className="min-w-0">
            {isDraft && (
              <div className="mb-5 no-print">
                <BudgetStructureButton />
              </div>
            )}
            <BudgetHeader key={activeBudget?.id || 'new'} />

            {isDraft && leadContext && draftBudget?.sourceLeadId === leadContext.id && (
              <section aria-label="Contexto de la solicitud" className="mt-5">
                <Card className="border-[#cddbd1] bg-[#f8faf7] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        Solicitud de {leadContext.contact.name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        <a className="underline" href={`mailto:${leadContext.contact.email}`}>
                          {leadContext.contact.email}
                        </a>{' '}
                        ·{' '}
                        <a
                          className="underline"
                          href={`tel:${leadContext.contact.phone.replace(/[^+\d]/g, '')}`}
                        >
                          {leadContext.contact.phone}
                        </a>
                      </p>
                    </div>
                    <Link
                      to="/profile/solicitudes"
                      className="text-sm font-medium text-[#426457] underline underline-offset-2"
                    >
                      Volver a solicitudes
                    </Link>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {leadContext.selections.map((selection, index) => {
                      const room = ESTIMATOR_ROOMS.find((item) => item.id === selection.room);
                      const quantity = selection.quantity ?? 1;
                      const ordinal = leadContext.selections
                        .slice(0, index + 1)
                        .filter(
                          (item) => item.room === selection.room && Boolean(item.instanceId),
                        ).length;
                      const roomLabel = selection.instanceId
                        ? `${room?.label ?? selection.room} ${ordinal}`
                        : quantity > 1
                          ? `${room?.pluralLabel ?? selection.room} (${quantity})`
                          : room?.label;
                      const areaLabel =
                        quantity > 1 && !selection.instanceId
                          ? `${selection.areaM2} m² c/u (${selection.areaM2 * quantity} m² total)`
                          : `${selection.areaM2} m²`;
                      return (
                        <li key={selection.instanceId ?? `${selection.room}-${index}`}>
                          {roomLabel} ·{' '}
                          {ESTIMATOR_SCOPES.find((item) => item.id === selection.scope)?.label} ·
                          Calidad{' '}
                          {(leadContext.schemaVersion === 2
                            ? ESTIMATOR_QUALITIES
                            : LEGACY_ESTIMATOR_QUALITIES
                          )
                            .find((item) => item.id === selection.quality)
                            ?.label?.toLowerCase()}{' '}
                          · {areaLabel}
                        </li>
                      );
                    })}
                  </ul>
                  {leadContext.startTiming && (
                    <p className="mt-3 text-sm text-gray-700">
                      Inicio previsto:{' '}
                      {LEAD_START_TIMINGS.find((option) => option.id === leadContext.startTiming)
                        ?.label ?? leadContext.startTiming}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-medium text-[#426457]">
                    Horquilla orientativa:{' '}
                    {(leadContext.estimate.minimumCents / 100).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                    {' – '}
                    {(leadContext.estimate.maximumCents / 100).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                    <span className="ml-2 font-normal text-gray-500">
                      sin IVA · no se copia como precio
                    </span>
                  </p>
                </Card>
              </section>
            )}

            <button
              onClick={togglePartidas}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer mt-4 mb-3 no-print px-2 py-1.5 -ml-2 rounded hover:bg-gray-50 uppercase"
              aria-expanded={showPartidas}
            >
              {showPartidas ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {t('budget.workItems')}
            </button>

            <div className={`collapsible ${showPartidas ? 'open' : ''} print:grid-rows-[1fr]!`}>
              <div>
                <BudgetEditor key={activeBudget?.id || 'new'} />

                <div className="mt-4 flex items-center gap-3 no-print">
                  <AddWorkItemButton />
                </div>
              </div>
            </div>

            <BudgetSummary />
          </fieldset>

          {/* Actions Bar */}
          <div className="mt-8 border-t border-gray-200 pt-6 no-print">
            {isDraft ? (
              <div className="draft-actions flex items-center justify-end gap-2">
                <Button className="draft-action-button" variant="danger" onClick={handleDiscard}>
                  <X size={16} />
                  {t('budget.discard')}
                </Button>
                <Button
                  className="draft-action-button"
                  onClick={() => void handleSave()}
                  loading={savingDraft}
                >
                  <Save size={16} />
                  {savingDraft ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <ShareButton />
                  {activeBudget && <ExportPdfButton budget={activeBudget} company={profile} />}
                </div>
                <div className="flex justify-end">
                  <SaveTemplateButton />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {activeBudget?.projectId ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        allowDraftNavigation.current = true;
                        startDraftFromBudget(budgetId);
                        navigate('/budget/new');
                      }}
                    >
                      <Copy size={16} />
                      Crear copia para editar
                    </Button>
                  ) : activeBudget?.acceptedAt ? (
                    <>
                      <Button variant="secondary" onClick={() => setShowWithdrawConfirm(true)}>
                        Retirar aceptación
                      </Button>
                      <Button onClick={() => setShowConvertConfirm(true)}>
                        <FolderKanban size={16} />
                        Convertir en proyecto
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setShowAcceptConfirm(true)}>
                      <CheckCircle2 size={16} />
                      Marcar como aceptado
                    </Button>
                  )}
                  {!readOnlySource && (
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 size={16} />
                      {t('budget.deleteBudget')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('budget.deleteConfirmTitle')}
        message={t('budget.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (budgetId && budgetId !== 'new') {
            await deleteBudget(budgetId);
          }
          setShowDeleteConfirm(false);
          navigate('/', { replace: true });
        }}
      />
      <ConfirmModal
        open={showAcceptConfirm}
        onClose={() => setShowAcceptConfirm(false)}
        title="¿Marcar como aceptado?"
        message="El presupuesto quedará bloqueado para edición. Podrás retirar la aceptación mientras no se haya convertido en proyecto."
        confirmLabel="Marcar como aceptado"
        variant="primary"
        onConfirm={async () => {
          await acceptBudget(budgetId);
          setShowAcceptConfirm(false);
        }}
      />
      <ConfirmModal
        open={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        title="¿Retirar la aceptación?"
        message="El presupuesto volverá a ser editable y podrás modificar la oferta."
        confirmLabel="Retirar aceptación"
        variant="primary"
        onConfirm={async () => {
          await withdrawBudgetAcceptance(budgetId);
          setShowWithdrawConfirm(false);
        }}
      />
      <ConfirmModal
        open={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        title="¿Convertir en proyecto?"
        message="Se guardará una copia independiente de esta oferta para seguir el avance. El presupuesto quedará como referencia de solo lectura y liberará una plaza de tu plan."
        confirmLabel="Convertir en proyecto"
        variant="primary"
        onConfirm={async () => {
          const projectId = await convertBudgetToProject(budgetId);
          linkProject(budgetId, projectId);
          setShowConvertConfirm(false);
          navigate(`/projects/${projectId}`);
        }}
      />
    </div>
  );
}
