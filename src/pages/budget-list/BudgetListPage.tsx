import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Settings, LogOut, Building2 } from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { useAuthStore } from '@/entities/auth';
import { formatCurrency } from '@/shared/lib';
import { Button } from '@/shared/ui';

export function BudgetListPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const getBudgetTotal = useBudgetStore((s) => s.getBudgetTotal);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const handleCreate = () => {
    navigate('/budget/new');
  };

  const handleOpen = (id: string) => {
    navigate(`/budget/${id}`);
  };

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
            <p className="text-sm text-gray-500 mt-1">
              {budgets.length === 0
                ? 'No hay presupuestos aún'
                : `${budgets.length} presupuesto${budgets.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={signOut} title="Cerrar sesión">
              <LogOut size={16} />
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')} title="Datos de empresa">
              <Building2 size={16} />
              <span className="hidden sm:inline">Empresa</span>
            </Button>
            <Button variant="secondary" onClick={() => navigate('/catalog')}>
              <Settings size={16} />
              <span className="hidden sm:inline">Catálogo</span>
            </Button>
            <Button onClick={handleCreate}>
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo presupuesto</span>
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
                    <div className="min-w-0 overflow-hidden">
                      <p className="font-semibold text-gray-900 truncate">
                        {budget.info.clientName || 'Sin nombre'}
                      </p>
                      {budget.info.address && (
                        <p className="text-xs text-gray-400 truncate overflow-hidden text-ellipsis whitespace-nowrap">{budget.info.address}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        {budget.info.budgetNumber && (
                          <span>Nº {budget.info.budgetNumber}</span>
                        )}
                        <span>{date}</span>
                        <span>{budget.sections.length} partida{budget.sections.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(total)}
                    </span>
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
