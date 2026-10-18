import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  FileText,
  Layers3,
  Wallet,
  Search,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { useUserStore } from '@/entities/user';
import { useCatalogStore } from '@/entities/catalog';
import type { SwipeDirection } from '@/shared/ui';
import { withTimeout } from '@/shared/model/session';
import { formatCurrency } from '@/shared/lib';
import { getBudgetSlotsUsed } from '@/shared/lib/utils';
import {
  Button,
  BudgetLimitReached,
  Modal,
  PageHeader,
  SwipeActions,
  ConfirmModal,
} from '@/shared/ui';
export function BudgetsPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const startFromTemplate = useBudgetStore((s) => s.startDraftFromTemplate);
  const templates = useTemplateStore((s) => s.templates);
  const catalogs = useCatalogStore((s) => s.catalogs);
  const account = useUserStore((s) => s.userData);
  const canCreate = useUserStore((s) => s.canCreateBudget);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; direction: SwipeDirection } | null>(null);
  const total = useBudgetStore((s) => s.getBudgetTotal);
  const navigate = useNavigate();
  const [chooseTemplate, setChooseTemplate] = useState(false);
  const [limit, setLimit] = useState(false);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(0);
  const years = [...new Set(budgets.map((budget) => budget.info.date.slice(0, 4)))]
    .filter((value) => /^\d{4}$/.test(value))
    .sort((a, b) => b.localeCompare(a));
  const filtered = [...budgets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((budget) => {
      if (year && !budget.info.date.startsWith(year)) return false;
      const searchableText = [
        budget.info.clientName,
        budget.info.address,
        budget.info.budgetNumber,
        ...budget.workItems.flatMap((workItem) => [
          workItem.name,
          ...workItem.tasks.map((task) => task.description),
        ]),
      ]
        .join(' ')
        .toLocaleLowerCase('es');
      return searchableText.includes(search.toLocaleLowerCase('es'));
    });
  const hasFilters = !!search || !!year;
  const totalValue = filtered.reduce((sum, budget) => sum + total(budget.id), 0);
  const displayedBudgetCount = filtered.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  const visible = filtered.slice(safePage * 8, safePage * 8 + 8);
  const create = () => {
    if (!canCreate()) setLimit(true);
    else if (templates.length) setChooseTemplate(true);
    else navigate('/budget/new');
  };
  return (
    <div className="page-container">
      <PageHeader
        title="Presupuestos"
        description="Consulta y gestiona tus presupuestos."
        actions={
          <Button
            className="page-create-button"
            data-tour="budget-create"
            aria-label="Crear presupuesto"
            onClick={create}
          >
            <Plus size={17} />
            <span className="page-create-label">Nuevo presupuesto</span>
          </Button>
        }
      />
      <section className="overview-grid" aria-label="Resumen de actividad">
        <div className="overview-card featured">
          <p>Valor presupuestado</p>
          <Wallet />
          <strong>{formatCurrency(totalValue)}</strong>
          <small>
            {hasFilters
              ? 'Suma de los presupuestos filtrados, IVA incluido'
              : 'Total de tus presupuestos, IVA incluido'}
          </small>
        </div>
        <div className="overview-card">
          <p>Presupuestos</p>
          <FileText />
          <strong>{String(displayedBudgetCount).padStart(2, '0')}</strong>
          <small>{hasFilters ? 'Presupuestos coincidentes' : 'Presupuestos guardados'}</small>
        </div>
        <div className="overview-card">
          <p>Tu biblioteca</p>
          <Layers3 />
          <strong>{String(catalogs.length + templates.length).padStart(2, '0')}</strong>
          <small>
            {catalogs.length} catálogo · {templates.length} plantillas
          </small>
        </div>
      </section>
      <section aria-labelledby="budget-list-heading">
        <div className="list-heading">
          <h2 id="budget-list-heading">
            Tus presupuestos<span>{filtered.length}</span>
          </h2>
          <div className="budget-list-filters">
            <div className="search-box">
              <Search size={14} />
              <input
                aria-label="Buscar presupuestos"
                placeholder="Cliente, dirección, número o concepto"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              aria-label="Filtrar presupuestos por año"
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos los años</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="budget-list">
          {visible.length ? (
            <>
              <div className="budget-list-head">
                <span>PROYECTO / CLIENTE</span>
                <span>FECHA</span>
                <span className="text-right">IMPORTE TOTAL</span>
                <span />
              </div>
              {visible.map((b) => (
                <SwipeActions
                  key={b.id}
                  label={b.info.clientName || 'Proyecto sin nombre'}
                  disableSwipe={!!b.acceptedAt || !!b.projectId}
                  openDirection={revealed?.id === b.id ? revealed.direction : null}
                  onReveal={(direction) => setRevealed(direction ? { id: b.id, direction } : null)}
                  actions={
                    b.projectId
                      ? [
                          {
                            id: 'open',
                            label: 'Abrir proyecto',
                            onAction: () => navigate(`/projects/${b.projectId}`),
                          },
                        ]
                      : b.acceptedAt
                        ? [
                            {
                              id: 'open',
                              label: 'Abrir presupuesto',
                              onAction: () => navigate(`/budget/${b.id}`),
                            },
                          ]
                        : [{ id: 'delete', label: 'Eliminar', onAction: () => setDeleting(b.id) }]
                  }
                >
                  <Link to={`/budget/${b.id}`} className="budget-list-row">
                    <div className="budget-identity">
                      <span className="document-number">{b.info.budgetNumber || '—'}</span>
                      <div className="min-w-0">
                        <h3>{b.info.clientName || 'Proyecto sin nombre'}</h3>
                        <p>{b.info.address || `${b.workItems.length} partidas de trabajo`}</p>
                        {b.projectId ? (
                          <p className="mt-1 font-medium text-[#183e3b]">Proyecto en seguimiento</p>
                        ) : b.acceptedAt ? (
                          <p className="mt-1 font-medium text-[#52625a]">Presupuesto aceptado</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="budget-date">
                      {b.info.date
                        ? new Date(b.info.date + 'T12:00:00').toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Sin fecha'}
                    </span>
                    <strong className="budget-amount">{formatCurrency(total(b.id))}</strong>
                    <ArrowUpRight size={17} className="text-gray-400" />
                  </Link>
                </SwipeActions>
              ))}
            </>
          ) : (
            <div className="empty-workspace">
              <FileText size={35} />
              <h2>{hasFilters ? 'Sin resultados' : 'No hay presupuestos'}</h2>
              <p>
                {hasFilters
                  ? 'No encontramos presupuestos con esos datos.'
                  : 'Crea un presupuesto para empezar.'}
              </p>
              {!hasFilters && (
                <Button onClick={create}>
                  Crear mi primer presupuesto
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="list-bottom">
          <span>
            {filtered.length
              ? `${safePage * 8 + 1}–${Math.min((safePage + 1) * 8, filtered.length)} de ${filtered.length} presupuestos`
              : '0 presupuestos'}
          </span>
          {filtered.length > 8 && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                disabled={(safePage + 1) * 8 >= filtered.length}
                onClick={() => setPage(safePage + 1)}
              >
                Siguiente
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      </section>
      <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-5 mt-5">
        <p className="text-xs text-gray-500">Gestiona los precios desde tu catálogo.</p>
        <Link className="text-xs text-blue-700 font-semibold flex items-center gap-2" to="/catalog">
          Explora tu catálogo
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="¿Borrar presupuesto?"
        message="Se eliminará este presupuesto. Esta acción no se puede deshacer."
        confirmLabel="Borrar presupuesto"
        onConfirm={async () => {
          if (!deleting) return;
          await withTimeout(deleteBudget(deleting));
          setDeleting(null);
        }}
      />
      <Modal open={chooseTemplate} onClose={() => setChooseTemplate(false)}>
        <h2 className="font-display text-2xl mb-2">Crear presupuesto</h2>
        <p className="text-xs text-gray-500 mb-5">
          Reutiliza lo que funciona o empieza desde cero.
        </p>
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              className="w-full text-left border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
              key={t.id}
              onClick={() => {
                startFromTemplate(t);
                navigate('/budget/new');
              }}
            >
              <strong className="text-sm">{t.name}</strong>
              <span className="block text-xs text-gray-500 mt-1">
                {t.workItems.length} partidas
              </span>
            </button>
          ))}
        </div>
        <Button className="mt-5 w-full justify-center" onClick={() => navigate('/budget/new')}>
          <Plus size={16} />
          Empezar en blanco
        </Button>
      </Modal>
      <Modal open={limit} onClose={() => setLimit(false)}>
        <BudgetLimitReached
          budgetSlotsUsed={getBudgetSlotsUsed(account?.totalBudgetsCreated ?? 0)}
        />
        <Button
          variant="secondary"
          className="mt-5 w-full justify-center"
          onClick={() => setLimit(false)}
        >
          Volver a mis proyectos
        </Button>
      </Modal>
    </div>
  );
}
