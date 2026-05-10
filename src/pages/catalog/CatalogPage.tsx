import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RotateCcw, ChevronDown, ChevronRight, Search, Info } from 'lucide-react';
import { useTariffStore, RENOVATION_CATEGORIES } from '@/entities/tariff';
import { UNIT_LABELS } from '@/shared/types';
import type { Unit } from '@/shared/types';
import { Button, ConfirmModal, EditableRow, EditableRowHeader, PageLayout } from '@/shared/ui';
import type { ColumnDef } from '@/shared/ui';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { t } from '@/shared/i18n';

function getCatalogColumns(): ColumnDef[] {
  return [
    { key: 'description', label: t('common.description'), width: 'minmax(0,1fr)' },
    { key: 'unit', label: t('common.unit'), width: '10%', align: 'center' },
    { key: 'cost', label: t('common.cost'), width: '13%', align: 'right' },
    { key: 'pvp', label: t('common.pvp'), width: '13%', align: 'right' },
    { key: 'margin', label: t('common.margin'), width: '13%', align: 'right', mobileHidden: true },
  ];
}

export function CatalogPage() {
  const tariffs = useTariffStore((s) => s.tariffs);
  const loaded = useTariffStore((s) => s.loaded);
  const addTariff = useTariffStore((s) => s.addTariff);
  const updateTariff = useTariffStore((s) => s.updateTariff);
  const removeTariff = useTariffStore((s) => s.removeTariff);
  const resetToDefaults = useTariffStore((s) => s.resetToDefaults);
  const navigate = useNavigate();

  const [showAdd, setShowAdd] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newUnit, setNewUnit] = useState<Unit>('m2');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAdd = () => {
    const desc = newDesc.trim();
    const cat = newCategory.trim();
    if (!desc || !cat) return;
    addTariff({
      description: desc,
      unit: newUnit,
      basePrice: parseFloat(newPrice) || 0,
      cost: parseFloat(newCost) || 0,
      category: cat,
    });
    setNewDesc('');
    setNewUnit('m2');
    setNewPrice('');
    setNewCost('');
    setNewCategory('');
    setIsCustomCategory(false);
    setShowAdd(false);
  };

  const allCategories = useMemo(() => {
    const cats = [...new Set([...RENOVATION_CATEGORIES, ...tariffs.map((t) => t.category)])];
    return cats.sort((a, b) => a.localeCompare(b, 'es'));
  }, [tariffs]);

  const grouped = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const filtered = q
      ? tariffs.filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q),
        )
      : tariffs;

    const map = new Map<string, typeof tariffs>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }

    // Sort categories using the canonical order from RENOVATION_CATEGORIES first,
    // then any custom categories alphabetically
    const catOrder = new Map<string, number>(RENOVATION_CATEGORIES.map((c, i) => [c, i]));
    return [...map.entries()].sort(([a], [b]) => {
      const ia = catOrder.get(a) ?? 999;
      const ib = catOrder.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'es');
    });
  }, [tariffs, debouncedSearch]);

  const toggleCategory = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const collapseAll = () => setCollapsedCats(new Set(grouped.map(([cat]) => cat)));
  const expandAll = () => setCollapsedCats(new Set());

  return (
    <PageLayout onBack={() => navigate('/')} backLabel={t('common.back')} maxWidth="4xl">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('catalog.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('catalog.stats', { 0: tariffs.length, 1: grouped.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              <span className="hidden sm:inline">{t('catalog.addTask')}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-sm rounded-lg px-3 py-2 mb-4">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>{t('catalog.disclaimer')}</span>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-lg border border-blue-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('catalog.newTask')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">{t('common.description')}</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder={t('catalog.descriptionPlaceholder')}
                  autoFocus
                />
              </div>
              <div className={isCustomCategory ? '' : 'sm:col-span-1'}>
                <label className="text-xs font-medium text-gray-600">{t('catalog.category')}</label>
                <select
                  value={isCustomCategory ? '__custom__' : newCategory}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomCategory(true);
                      setNewCategory('');
                    } else {
                      setIsCustomCategory(false);
                      setNewCategory(e.target.value);
                    }
                  }}
                  className="mt-1 w-full appearance-none rounded-md border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t('catalog.categoryPlaceholder')}</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">{t('addWorkItem.custom')}</option>
                </select>
              </div>
              {isCustomCategory && (
                <div>
                  <label className="text-xs font-medium text-gray-600">{t('addWorkItem.custom')}</label>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    placeholder={t('addWorkItem.customPlaceholder')}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600">{t('common.unit')}</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as Unit)}
                  className="mt-1 w-full appearance-none rounded-md border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {Object.entries(UNIT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('common.cost')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder={t('catalog.costPlaceholder')}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{t('common.pvp')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder={t('catalog.pricePlaceholder')}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleAdd}>{t('common.add')}</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}

        {!loaded ? (
          <CatalogSkeleton />
        ) : (
        <>
        {/* Search + collapse controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('catalog.search')}
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1">
            <button onClick={expandAll} className="text-xs text-blue-600 hover:underline cursor-pointer">
              {t('catalog.expandAll')}
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline cursor-pointer">
              {t('catalog.collapseAll')}
            </button>
          </div>
        </div>

        {/* Category sidebar pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
              activeCategory === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Todas ({tariffs.length})
          </button>
          {grouped.map(([cat, items]) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {cat} ({items.length})
            </button>
          ))}
        </div>

        {/* Grouped tariffs */}
        <div className="space-y-3">
          {grouped
            .filter(([cat]) => !activeCategory || cat === activeCategory)
            .map(([cat, items]) => {
              const isCollapsed = collapsedCats.has(cat);
              return (
                <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                      <span className="text-sm font-semibold text-gray-800">{cat}</span>
                      <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>
                  </button>

                  {/* Category items */}
                  <div className={`collapsible ${!isCollapsed ? 'open' : ''}`}>
                    <div className="overflow-hidden">
                    <EditableRowHeader columns={getCatalogColumns()} />
                    <div className="space-y-2 sm:space-y-0 p-3 sm:p-0">
                      {items.map((tariff) => {
                        const margin = tariff.basePrice > 0 ? ((tariff.basePrice - tariff.cost) / tariff.basePrice) * 100 : 0;
                        return (
                          <EditableRow
                            key={tariff.id}
                            columns={getCatalogColumns()}
                            cells={{
                              description: { type: 'text', value: tariff.description, onChange: (v) => updateTariff(tariff.id, { description: v }) },
                              unit: { type: 'unit-select', value: tariff.unit, onChange: (v) => updateTariff(tariff.id, { unit: v as Unit }) },
                              cost: { type: 'number', value: tariff.cost, onChange: (v) => updateTariff(tariff.id, { cost: parseFloat(v) || 0 }) },
                              pvp: { type: 'number', value: tariff.basePrice, onChange: (v) => updateTariff(tariff.id, { basePrice: parseFloat(v) || 0 }) },
                              margin: { type: 'display', content: <span className={`text-xs font-medium ${margin > 0 ? 'text-green-600' : 'text-gray-400'}`}>{margin.toFixed(1)}%</span> },
                            }}
                            onDelete={() => removeTariff(tariff.id)}
                            mobileFooter={{
                              label: t('common.margin'),
                              value: <span className={`text-xs font-semibold ${margin > 0 ? 'text-green-600' : 'text-gray-400'}`}>{margin.toFixed(1)}%</span>,
                            }}
                          />
                        );
                      })}
                    </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {grouped.length === 0 && search && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">{t('catalog.noResults', { 0: search })}</p>
          </div>
        )}

        {/* Restore defaults */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
          <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={14} />
            {t('catalog.resetDefaults')}
          </Button>
        </div>
        </>
        )}

      <ConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('catalog.resetConfirmTitle')}
        message={t('catalog.resetConfirmMessage')}
        confirmLabel={t('catalog.reset')}
        onConfirm={async () => {
          await resetToDefaults();
          setShowResetConfirm(false);
        }}
      />
    </PageLayout>
  );
}
