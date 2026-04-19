import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, RotateCcw, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useTariffStore, RENOVATION_CATEGORIES } from '@/entities/tariff';
import { UNIT_LABELS } from '@/shared/types';
import type { Unit } from '@/shared/types';
import { Button } from '@/shared/ui';

export function CatalogPage() {
  const tariffs = useTariffStore((s) => s.tariffs);
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
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Volver a presupuestos
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catálogo de tarifas</h1>
            <p className="text-sm text-gray-500 mt-1">
              {tariffs.length} conceptos · {grouped.length} categorías
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              <span className="hidden sm:inline">Añadir concepto</span>
            </Button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-lg border border-blue-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Nuevo concepto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">Descripción</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Ej. Instalación de tarima"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Categoría</label>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Selecciona o escribe"
                  list="new-categories"
                />
                <datalist id="new-categories">
                  {allCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Ud.</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as Unit)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                >
                  {Object.entries(UNIT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Coste</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">PVP</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleAdd}>Añadir</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Search + collapse controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción o categoría..."
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1">
            <button onClick={expandAll} className="text-xs text-blue-600 hover:underline cursor-pointer">
              Expandir todo
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline cursor-pointer">
              Colapsar todo
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
                  {!isCollapsed && (
                    <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-2 w-[40%]">Descripción</th>
                          <th className="px-4 py-2 w-[10%] text-center">Ud.</th>
                          <th className="px-4 py-2 w-[13%] text-right">Coste</th>
                          <th className="px-4 py-2 w-[13%] text-right">PVP</th>
                          <th className="px-4 py-2 w-[13%] text-right">Margen</th>
                          <th className="px-4 py-2 w-[6%]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map((t) => {
                          const margin =
                            t.basePrice > 0
                              ? ((t.basePrice - t.cost) / t.basePrice) * 100
                              : 0;
                          return (
                            <tr key={t.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-1.5">
                                <input
                                  value={t.description}
                                  onChange={(e) => updateTariff(t.id, { description: e.target.value })}
                                  className="w-full bg-transparent border-none outline-none text-sm"
                                />
                              </td>
                              <td className="px-4 py-1.5 text-center">
                                <select
                                  value={t.unit}
                                  onChange={(e) => updateTariff(t.id, { unit: e.target.value as Unit })}
                                  className="bg-transparent border-none outline-none text-sm text-center cursor-pointer"
                                >
                                  {Object.entries(UNIT_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={t.cost || ''}
                                  onChange={(e) => updateTariff(t.id, { cost: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-transparent border-none outline-none text-right text-sm"
                                />
                              </td>
                              <td className="px-4 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={t.basePrice || ''}
                                  onChange={(e) => updateTariff(t.id, { basePrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-transparent border-none outline-none text-right text-sm"
                                />
                              </td>
                              <td className="px-4 py-1.5 text-right">
                                <span className={`text-xs font-medium ${margin > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-1.5 text-center">
                                <button
                                  onClick={() => removeTariff(t.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {grouped.length === 0 && search && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">Sin resultados para "{search}"</p>
          </div>
        )}

        {/* Restore defaults */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
          <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw size={14} />
            Restaurar catálogo por defecto
          </Button>
        </div>
      </div>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Restaurar catálogo?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Se eliminarán todas las tarifas personalizadas y se restaurarán las tarifas por defecto. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await resetToDefaults();
                  setShowResetConfirm(false);
                }}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
