import { useEffect, useState } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
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
import { Button, Card, ConfirmModal, BudgetLimitReached, PageHeader } from '@/shared/ui';
import { BudgetSkeleton } from './components/BudgetSkeleton';
import { Trash2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { t } from '@/shared/i18n';

export function BudgetDetailPage() {
  const { budgetId = 'new' } = useParams<{ budgetId: string }>();
  return <BudgetDetailContent key={budgetId} budgetId={budgetId} />;
}
function BudgetDetailContent({ budgetId }: { budgetId: string }) {
  const navigate = useNavigate();
  const isDraft = budgetId === 'new';

  const setActiveBudget = useBudgetStore((s) => s.setActiveBudget);
  const startDraft = useBudgetStore((s) => s.startDraft);
  const savingDraft = useBudgetStore((s) => s.savingDraft);
  const [saveError, setSaveError] = useState('');
  const saveDraft = useBudgetStore((s) => s.saveDraft);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const draftBudget = useBudgetStore((s) => s.draftBudget);
  const canCreateBudget = useUserStore((s) => s.canCreateBudget);
  const userData = useUserStore((s) => s.userData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  // Initialize draft or set active budget
  useEffect(() => {
    if (isDraft) {
      startDraft(activeCatalogId ?? undefined);
    } else if (budgetId) {
      setActiveBudget(budgetId);
    }
    return () => {
      if (!isDraft) setActiveBudget(null);
    };
  }, [budgetId, isDraft, setActiveBudget, startDraft, activeCatalogId]);

  // Block in-app navigation when draft has content
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false;
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
          <BudgetLimitReached totalBudgetsCreated={userData?.totalBudgetsCreated ?? 0} />
        </div>
      </div>
    );
  }

  if (isDraft && !draftBudget) return null;

  return (
    <div className="page-container budget-document">
      <div className="budget-document-content print:p-[10mm]">
        <PageHeader
          title={isDraft ? 'Nuevo presupuesto' : 'Presupuesto'}
          description="Define las partidas, revisa los importes y completa los datos del cliente."
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
        <fieldset disabled={savingDraft} className="min-w-0">
          <Card className="p-4 sm:p-8 print:shadow-none print:border-none print:rounded-none">
            {isDraft && (
              <div className="mb-5 no-print">
                <BudgetStructureButton />
              </div>
            )}
            <BudgetHeader key={activeBudget?.id || 'new'} />

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
                  <div className="flex justify-end">
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 size={16} />
                      {t('budget.deleteBudget')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </fieldset>
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
    </div>
  );
}
