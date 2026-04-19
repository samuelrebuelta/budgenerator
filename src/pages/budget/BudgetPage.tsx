import { useEffect, useState } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { BudgetHeader } from './components/BudgetHeader';
import { BudgetEditor } from './components/BudgetEditor';
import { BudgetSummary } from './components/BudgetSummary';
import { AddSectionButton } from './components/AddSectionButton';
import { ExportPdfButton } from './components/ExportPdfButton';
import { useBudgetStore } from '@/entities/budget';
import { Button } from '@/shared/ui';
import { Trash2, ArrowLeft, Save, X, ChevronDown, ChevronRight } from 'lucide-react';

export function BudgetPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const isDraft = budgetId === 'new';

  const setActiveBudget = useBudgetStore((s) => s.setActiveBudget);
  const startDraft = useBudgetStore((s) => s.startDraft);
  const saveDraft = useBudgetStore((s) => s.saveDraft);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const draftBudget = useBudgetStore((s) => s.draftBudget);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPartidas, setShowPartidas] = useState(true);
  const budgetExists = useBudgetStore((s) =>
    s.budgets.some((b) => b.id === budgetId),
  );
  const budgetsLoaded = useBudgetStore((s) => s.loaded);

  // Initialize draft or set active budget
  useEffect(() => {
    if (isDraft) {
      startDraft();
    } else if (budgetId) {
      setActiveBudget(budgetId);
    }
    return () => {
      if (!isDraft) setActiveBudget(null);
    };
  }, [budgetId, isDraft, setActiveBudget, startDraft]);

  // Block in-app navigation when draft has content
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false;
    const draft = useBudgetStore.getState().draftBudget;
    if (!draft) return false;
    return (
      draft.info.clientName !== '' ||
      draft.info.address !== '' ||
      draft.info.budgetNumber !== '' ||
      draft.sections.length > 0
    );
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm(
        'Hay cambios sin guardar. ¿Deseas salir sin guardar?',
      );
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
        (draft.info.clientName !== '' ||
          draft.info.address !== '' ||
          draft.info.budgetNumber !== '' ||
          draft.sections.length > 0)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDraft]);

  const handleSave = async () => {
    const id = await saveDraft();
    if (id) navigate(`/budget/${id}`, { replace: true });
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
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }
  if (!isDraft && !budgetExists) return null;
  if (isDraft && !draftBudget) return null;

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100 print:bg-white">
      <div className="max-w-5xl mx-auto sm:py-8 sm:px-6 print:max-w-none print:py-0 print:px-0 print:p-[10mm]">
        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 px-4 pt-4 sm:px-0 sm:pt-0 no-print cursor-pointer"
        >
          <ArrowLeft size={14} />
          Volver a presupuestos
        </button>

        {isDraft && (
          <div className="mb-4 mx-4 sm:mx-0 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 no-print">
            Borrador — Este presupuesto no se guardará hasta que pulses <strong>Guardar</strong>.
          </div>
        )}

        {/* Page Card */}
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8 print:shadow-none print:border-none print:rounded-none">
          <BudgetHeader />

          <button
            onClick={() => setShowPartidas((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer mt-4 mb-3 no-print px-2 py-1.5 -ml-2 rounded hover:bg-gray-50"
            aria-expanded={showPartidas}
          >
            {showPartidas ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Partidas
          </button>

          <div className={`${showPartidas ? '' : 'hidden'} print:!block`}>
            <BudgetEditor />

            <div className="mt-4 flex items-center gap-3 no-print">
              <AddSectionButton />
            </div>
          </div>

          <BudgetSummary />

          {/* Actions Bar */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 no-print">
            {isDraft ? (
              <>
                <Button variant="danger" onClick={handleDiscard}>
                  <X size={16} />
                  Descartar
                </Button>
                <Button onClick={handleSave}>
                  <Save size={16} />
                  Guardar presupuesto
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={16} />
                  Borrar presupuesto
                </Button>
                <ExportPdfButton />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 no-print">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Borrar presupuesto?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Se eliminará el presupuesto de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (budgetId && budgetId !== 'new') {
                    await deleteBudget(budgetId);
                  }
                  setShowDeleteConfirm(false);
                  navigate('/', { replace: true });
                }}
              >
                Borrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
