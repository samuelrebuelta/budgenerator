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
import { formatCurrency } from '@/shared/lib';
import { Button, BudgetLimitReached, Modal } from '@/shared/ui';
export function BudgetsPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const startFromTemplate = useBudgetStore((s) => s.startDraftFromTemplate);
  const templates = useTemplateStore((s) => s.templates);
  const catalogs = useCatalogStore((s) => s.catalogs);
  const account = useUserStore((s) => s.userData);
  const canCreate = useUserStore((s) => s.canCreateBudget);
  const total = useBudgetStore((s) => s.getBudgetTotal);
  const navigate = useNavigate();
  const [chooseTemplate, setChooseTemplate] = useState(false);
  const [limit, setLimit] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const totalValue = budgets.reduce((sum, b) => sum + total(b.id), 0);
  const filtered = [...budgets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((b) =>
      `${b.info.clientName} ${b.info.address} ${b.info.budgetNumber}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
    );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1));
  const visible = filtered.slice(safePage * 8, safePage * 8 + 8);
  const create = () => {
    if (!canCreate()) setLimit(true);
    else if (templates.length) setChooseTemplate(true);
    else navigate('/budget/new');
  };
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RESUMEN</p>
          <h1>Presupuestos</h1>
          <p>Consulta y gestiona tus presupuestos.</p>
        </div>
        <Button onClick={create}>
          <Plus size={17} />
          Nuevo presupuesto
        </Button>
      </div>
      <section className="overview-grid" aria-label="Resumen de actividad">
        <div className="overview-card featured">
          <p>Valor presupuestado</p>
          <Wallet />
          <strong>{formatCurrency(totalValue)}</strong>
          <small>Total de tus presupuestos, IVA incluido</small>
        </div>
        <div className="overview-card">
          <p>Presupuestos</p>
          <FileText />
          <strong>{String(budgets.length).padStart(2, '0')}</strong>
          <small>Presupuestos guardados</small>
        </div>
        <div className="overview-card">
          <p>Tu biblioteca</p>
          <Layers3 />
          <strong>{String(catalogs.length + templates.length).padStart(2, '0')}</strong>
          <small>
            {catalogs.length} catálogos · {templates.length} plantillas
          </small>
        </div>
      </section>
      <section aria-labelledby="budget-list-heading">
        <div className="list-heading">
          <h2 id="budget-list-heading">
            Tus presupuestos<span>{budgets.length}</span>
          </h2>
          <div className="search-box">
            <Search size={14} />
            <input
              aria-label="Buscar presupuestos"
              placeholder="Busca un cliente, dirección o número"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
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
                <Link to={`/budget/${b.id}`} key={b.id} className="budget-list-row">
                  <div className="budget-identity">
                    <span className="document-number">{b.info.budgetNumber || '—'}</span>
                    <div className="min-w-0">
                      <h3>{b.info.clientName || 'Proyecto sin nombre'}</h3>
                      <p>{b.info.address || `${b.workItems.length} partidas de trabajo`}</p>
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
              ))}
            </>
          ) : (
            <div className="empty-workspace">
              <FileText size={35} />
              <h2>{search ? 'Sin resultados' : 'No hay presupuestos'}</h2>
              <p>
                {search
                  ? 'No encontramos presupuestos con esos datos.'
                  : 'Crea un presupuesto para empezar.'}
              </p>
              {!search && (
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
        <p className="text-xs text-gray-500">Gestiona los precios desde tus catálogos.</p>
        <Link
          className="text-xs text-blue-700 font-semibold flex items-center gap-2"
          to="/catalogs"
        >
          Explora tus catálogos
          <ArrowUpRight size={14} />
        </Link>
      </div>
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
        <BudgetLimitReached totalBudgetsCreated={account?.totalBudgetsCreated ?? 0} />
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
