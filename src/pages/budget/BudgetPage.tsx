import { useEffect } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { BudgetHeader } from './components/BudgetHeader';
import { BudgetEditor } from './components/BudgetEditor';
import { BudgetSummary } from './components/BudgetSummary';
import { AddSectionButton } from './components/AddSectionButton';
import { ExportPdfButton } from './components/ExportPdfButton';
import { useBudgetStore } from '@/entities/budget';
import { Button } from '@/shared/ui';
import { RotateCcw, ArrowLeft, Save, X } from 'lucide-react';

export function BudgetPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const isDraft = budgetId === 'new';

  const setActiveBudget = useBudgetStore((s) => s.setActiveBudget);
  const startDraft = useBudgetStore((s) => s.startDraft);
  const saveDraft = useBudgetStore((s) => s.saveDraft);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const resetBudget = useBudgetStore((s) => s.resetBudget);
  const draftBudget = useBudgetStore((s) => s.draftBudget);
  const budgetExists = useBudgetStore((s) =>
    s.budgets.some((b) => b.id === budgetId),
  );

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

  const handleSave = () => {
    const id = saveDraft();
    if (id) navigate(`/budget/${id}`, { replace: true });
  };

  const handleDiscard = () => {
    discardDraft();
    navigate('/');
  };

  // Redirect if budget doesn't exist
  useEffect(() => {
    if (!isDraft && budgetId && !budgetExists) {
      navigate('/', { replace: true });
    }
  }, [isDraft, budgetId, budgetExists, navigate]);

  if (!isDraft && !budgetExists) return null;
  if (isDraft && !draftBudget) return null;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 print:py-0 print:px-0">
        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 no-print cursor-pointer"
        >
          <ArrowLeft size={14} />
          Volver a presupuestos
        </button>

        {isDraft && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 no-print">
            Borrador — Este presupuesto no se guardará hasta que pulses <strong>Guardar</strong>.
          </div>
        )}

        {/* Page Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 print:shadow-none print:border-none print:rounded-none">
          <BudgetHeader />

          <div className="mt-6">
            <BudgetEditor />
          </div>

          <div className="mt-4 flex items-center gap-3 no-print">
            <AddSectionButton />
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
                <Button variant="danger" onClick={resetBudget}>
                  <RotateCcw size={16} />
                  Reiniciar presupuesto
                </Button>
                <ExportPdfButton />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
