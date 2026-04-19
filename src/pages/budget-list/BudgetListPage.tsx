import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, FileText, Settings } from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { formatCurrency } from '@/shared/lib';
import { Button } from '@/shared/ui';

export function BudgetListPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const getBudgetTotal = useBudgetStore((s) => s.getBudgetTotal);
  const navigate = useNavigate();

  const handleCreate = () => {
    navigate('/budget/new');
  };

  const handleOpen = (id: string) => {
    navigate(`/budget/${id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteBudget(id);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
            <p className="text-sm text-gray-500 mt-1">
              {budgets.length === 0
                ? 'No hay presupuestos aún'
                : `${budgets.length} presupuesto${budgets.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/catalog')}>
              <Settings size={16} />
              Catálogo
            </Button>
            <Button onClick={handleCreate}>
              <Plus size={16} />
              Nuevo presupuesto
            </Button>
          </div>
        </div>

        {budgets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">Sin presupuestos</p>
            <p className="text-sm text-gray-400 mt-1">
              Crea tu primer presupuesto para empezar
            </p>
            <Button onClick={handleCreate} className="mt-6">
              <Plus size={16} />
              Crear presupuesto
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {[...budgets].reverse().map((budget) => {
              const total = getBudgetTotal(budget.id);
              const date = budget.info.date
                ? new Date(budget.info.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';

              return (
                <div
                  key={budget.id}
                  onClick={() => handleOpen(budget.id)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {budget.info.clientName || 'Sin nombre'}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        {budget.info.budgetNumber && (
                          <span>Nº {budget.info.budgetNumber}</span>
                        )}
                        <span>{date}</span>
                        <span>{budget.sections.length} sección{budget.sections.length !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(total)}
                    </span>
                    <Button
                      variant="danger"
                      onClick={(e) => handleDelete(e, budget.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
