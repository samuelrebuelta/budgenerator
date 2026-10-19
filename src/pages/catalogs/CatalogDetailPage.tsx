import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  compareSpanish,
  normalizeCatalogText,
  searchCatalogParts,
  TRADE_CATALOGS,
  useCatalogStore,
} from '@/entities/catalog';
import { UNIT_LABELS } from '@/shared/types';
import type { CatalogPart, Unit, TariffCatalog } from '@/shared/types';
import type { BaseCatalog } from '@/entities/catalog';
import type { TradeImportScope } from '@/entities/catalog';
import {
  Button,
  ConfirmModal,
  EditableRow,
  EditableRowHeader,
  PageLayout,
  PageHeader,
  PageHeaderSkeleton,
  Modal,
} from '@/shared/ui';
import type { ColumnDef } from '@/shared/ui';
import { CatalogSkeleton } from './components/CatalogSkeleton';
import { decimal } from '@/shared/lib/budgetMath';
import { t } from '@/shared/i18n';
import { catalogSummary } from './catalogSummary';

function getTradeParts(trade: BaseCatalog) {
  const groups = new Map<string, { name: string; concepts: BaseCatalog['tariffs'] }>();
  for (const tariff of trade.tariffs) {
    const name = tariff.category.trim() || trade.name;
    const key = normalizeCatalogText(name);
    const group = groups.get(key) ?? { name, concepts: [] };
    group.concepts.push(tariff);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => compareSpanish(a.name, b.name));
}

function getCatalogColumns(): ColumnDef[] {
  return [
    { key: 'description', label: t('common.description'), width: 'minmax(0,1fr)' },
    { key: 'unit', label: t('common.unit'), width: '10%', align: 'center' },
    { key: 'cost', label: t('common.cost'), width: '13%', align: 'right' },
    { key: 'pvp', label: t('common.pvp'), width: '13%', align: 'right' },
    { key: 'margin', label: t('common.margin'), width: '13%', align: 'right', mobileHidden: true },
  ];
}

function CatalogEditor({ catalog }: { catalog: TariffCatalog }) {
  const addPart = useCatalogStore((s) => s.addPart);
  const importTrade = useCatalogStore((s) => s.importTrade);
  const renamePart = useCatalogStore((s) => s.renamePart);
  const removePart = useCatalogStore((s) => s.removePart);
  const addConcept = useCatalogStore((s) => s.addConcept);
  const updateConcept = useCatalogStore((s) => s.updateConcept);
  const removeConcept = useCatalogStore((s) => s.removeConcept);
  const [showAddPart, setShowAddPart] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [addingToPartId, setAddingToPartId] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [newUnit, setNewUnit] = useState<Unit>('m2');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [partToDelete, setPartToDelete] = useState<CatalogPart | null>(null);
  const [showTradeImporter, setShowTradeImporter] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [expandedTradeParts, setExpandedTradeParts] = useState<Set<string>>(new Set());
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredParts = useMemo(
    () => searchCatalogParts(catalog.parts, debouncedQuery),
    [catalog.parts, debouncedQuery],
  );
  const visibleParts = filteredParts.filter((part) => !activePartId || part.id === activePartId);
  const allPartsCollapsed =
    catalog.parts.length > 0 && catalog.parts.every((part) => collapsed.has(part.id));
  const filteredCategories = useMemo(() => {
    const words = normalizeCatalogText(categoryQuery).split(/\s+/).filter(Boolean);
    return TRADE_CATALOGS.filter((trade) => {
      const searchable = normalizeCatalogText(
        [
          trade.name,
          trade.description,
          ...trade.tariffs.flatMap((tariff) => [tariff.category, tariff.description]),
        ].join(' '),
      );
      return words.every((word) => searchable.includes(word));
    }).sort((a, b) => compareSpanish(a.name, b.name));
  }, [categoryQuery]);
  const selectedCategory = TRADE_CATALOGS.find((trade) => trade.id === selectedTradeId);
  const selectedCategoryParts = selectedCategory ? getTradeParts(selectedCategory) : [];

  const submitPart = () => {
    const name = newPartName.trim();
    if (!name) return;
    addPart(name, catalog.id);
    setNewPartName('');
    setShowAddPart(false);
  };

  const submitConcept = (partId: string) => {
    const description = newDescription.trim();
    if (!description) return;
    addConcept(
      partId,
      {
        description,
        unit: newUnit,
        basePrice: decimal(newPrice),
        cost: decimal(newCost),
      },
      catalog.id,
    );
    setNewDescription('');
    setNewUnit('m2');
    setNewPrice('');
    setNewCost('');
    setAddingToPartId(null);
  };

  const toggleAllParts = () =>
    setCollapsed(allPartsCollapsed ? new Set() : new Set(catalog.parts.map((part) => part.id)));

  const togglePart = (partId: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });

  const openTradeImporter = () => {
    setCategoryQuery('');
    setSelectedTradeId(null);
    setExpandedTradeParts(new Set());
    setImportMessage('');
    setShowTradeImporter(true);
  };

  const submitCategoryImport = (category: BaseCatalog, scope: TradeImportScope) => {
    const result = importTrade(category.id, catalog.id, scope);
    const selectedName =
      scope.type === 'category'
        ? category.name
        : scope.type === 'part'
          ? scope.partName
          : scope.description;
    const message =
      result.addedConcepts > 0
        ? scope.type === 'concept'
          ? `Se añadió «${selectedName}» al catálogo de tu empresa.`
          : scope.type === 'part'
            ? `Se añadieron ${result.addedConcepts} conceptos de «${selectedName}».`
            : `Se importaron ${result.addedConcepts} conceptos de ${selectedName} y ${result.addedParts} partidas nuevas.`
        : scope.type === 'concept'
          ? `«${selectedName}» ya está en el catálogo.`
          : `Todo lo de «${selectedName}» ya estaba en el catálogo.`;
    setImportMessage(message);
    if (scope.type === 'category') {
      setSelectedTradeId(null);
      setShowTradeImporter(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Catálogo"
        description={catalogSummary(catalog.parts)}
        backTo="/budgets"
        backLabel="Volver a presupuestos"
        actions={
          <Button
            className="page-create-button"
            aria-label="Añadir partida"
            onClick={() => setShowAddPart(true)}
          >
            <Plus size={16} />
            <span className="page-create-label">Añadir partida</span>
          </Button>
        }
      />
      <div className="mb-6 flex items-start gap-2 text-xs text-gray-500">
        <Info size={16} className="shrink-0" />
        <span>{t('catalog.disclaimer')}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="secondary" data-tour="category-import" onClick={openTradeImporter}>
          <Download size={16} /> Importar por categoría
        </Button>
        {catalog.parts.length > 0 && (
          <Button variant="secondary" onClick={toggleAllParts}>
            {allPartsCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            {allPartsCollapsed ? 'Expandir todo' : 'Contraer todo'}
          </Button>
        )}
      </div>
      {importMessage && !showTradeImporter && (
        <p role="status" className="mb-4 text-sm text-green-800">
          {importMessage}
        </p>
      )}
      {showAddPart && (
        <form
          className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitPart();
          }}
        >
          <label className="min-w-48 flex-1 text-xs font-medium text-gray-600">
            Nombre de la partida
            <input
              autoFocus
              value={newPartName}
              onChange={(event) => setNewPartName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ej. Fontanería"
            />
          </label>
          <Button type="submit" disabled={!newPartName.trim()}>
            <Plus size={16} /> Añadir
          </Button>
          <Button variant="ghost" type="button" onClick={() => setShowAddPart(false)}>
            Cancelar
          </Button>
        </form>
      )}

      <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <label className="relative w-full max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar partidas y conceptos"
            placeholder="Buscar partida o concepto…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </label>
        {catalog.parts.length > 0 && (
          <select
            aria-label="Filtrar por partida"
            value={activePartId ?? ''}
            onChange={(event) => setActivePartId(event.target.value || null)}
            className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">Todas las partidas ({catalog.parts.length})</option>
            {[...catalog.parts]
              .sort((a, b) => compareSpanish(a.name, b.name))
              .map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name} ({part.concepts.length})
                </option>
              ))}
          </select>
        )}
      </div>

      {visibleParts.length > 0 ? (
        <div className="space-y-3">
          {visibleParts.map((part) => {
            const isCollapsed = collapsed.has(part.id);
            return (
              <section
                key={part.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <button
                    type="button"
                    aria-label={`${isCollapsed ? 'Expandir' : 'Contraer'} ${part.name}`}
                    aria-expanded={!isCollapsed}
                    onClick={() => togglePart(part.id)}
                    className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <input
                    key={`${part.id}-${part.name}`}
                    aria-label="Nombre de la partida"
                    defaultValue={part.name}
                    onBlur={(event) => {
                      const value = event.currentTarget.value.trim();
                      if (value && value !== part.name) renamePart(part.id, value, catalog.id);
                      else event.currentTarget.value = part.name;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    className="min-w-32 flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                    {part.concepts.length} {part.concepts.length === 1 ? 'concepto' : 'conceptos'}
                  </span>
                  <Button
                    variant="secondary"
                    className={isCollapsed ? 'hidden min-[801px]:inline-flex' : undefined}
                    onClick={() => {
                      if (isCollapsed) togglePart(part.id);
                      setAddingToPartId(part.id);
                    }}
                    aria-label={`Añadir concepto a ${part.name}`}
                  >
                    <Plus size={15} /> Añadir concepto
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Eliminar partida ${part.name}`}
                    onClick={() => setPartToDelete(part)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>

                {!isCollapsed && (
                  <div>
                    {addingToPartId === part.id && (
                      <form
                        className="flex flex-wrap items-end gap-2 border-b border-gray-100 p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitConcept(part.id);
                        }}
                      >
                        <label className="min-w-48 flex-1 text-xs text-gray-600">
                          Nombre del concepto
                          <input
                            autoFocus
                            value={newDescription}
                            onChange={(event) => setNewDescription(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-600">
                          Unidad
                          <select
                            value={newUnit}
                            onChange={(event) => setNewUnit(event.target.value as Unit)}
                            className="mt-1 block rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                          >
                            {Object.entries(UNIT_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-gray-600">
                          Coste
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={newCost}
                            onChange={(event) => setNewCost(event.target.value)}
                            className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-600">
                          Precio
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={newPrice}
                            onChange={(event) => setNewPrice(event.target.value)}
                            className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>
                        <Button type="submit" disabled={!newDescription.trim()}>
                          <Plus size={15} /> Añadir
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setAddingToPartId(null)}
                          aria-label="Cancelar"
                        >
                          <X size={16} />
                        </Button>
                      </form>
                    )}
                    {part.concepts.length > 0 ? (
                      <>
                        <EditableRowHeader columns={getCatalogColumns()} />
                        <div className="space-y-2 p-3 sm:space-y-0 sm:p-0">
                          {part.concepts
                            .sort((a, b) => compareSpanish(a.description, b.description))
                            .map((concept) => {
                              const margin =
                                concept.basePrice > 0
                                  ? ((concept.basePrice - concept.cost) / concept.basePrice) * 100
                                  : 0;
                              return (
                                <EditableRow
                                  key={concept.id}
                                  columns={getCatalogColumns()}
                                  cells={{
                                    description: {
                                      type: 'text',
                                      value: concept.description,
                                      onChange: (value) =>
                                        updateConcept(
                                          part.id,
                                          concept.id,
                                          { description: value },
                                          catalog.id,
                                        ),
                                    },
                                    unit: {
                                      type: 'unit-select',
                                      value: concept.unit,
                                      onChange: (value) =>
                                        updateConcept(
                                          part.id,
                                          concept.id,
                                          { unit: value as Unit },
                                          catalog.id,
                                        ),
                                    },
                                    cost: {
                                      type: 'number',
                                      value: concept.cost,
                                      onChange: (value) =>
                                        updateConcept(
                                          part.id,
                                          concept.id,
                                          { cost: decimal(value) },
                                          catalog.id,
                                        ),
                                    },
                                    pvp: {
                                      type: 'number',
                                      value: concept.basePrice,
                                      onChange: (value) =>
                                        updateConcept(
                                          part.id,
                                          concept.id,
                                          { basePrice: decimal(value) },
                                          catalog.id,
                                        ),
                                    },
                                    margin: {
                                      type: 'display',
                                      content: (
                                        <span
                                          className={`text-xs font-medium ${margin > 0 ? 'text-green-600' : 'text-gray-400'}`}
                                        >
                                          {margin.toFixed(1)}%
                                        </span>
                                      ),
                                    },
                                  }}
                                  onDelete={() => removeConcept(part.id, concept.id, catalog.id)}
                                  mobileFooter={{
                                    label: t('common.margin'),
                                    value: (
                                      <span
                                        className={`text-xs font-semibold ${margin > 0 ? 'text-green-600' : 'text-gray-400'}`}
                                      >
                                        {margin.toFixed(1)}%
                                      </span>
                                    ),
                                  }}
                                />
                              );
                            })}
                        </div>
                      </>
                    ) : (
                      <p className="px-4 py-5 text-sm text-gray-500">
                        Esta partida aún no tiene conceptos.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="catalog-empty">
          <h2>{query ? 'No hay resultados' : 'Aún no hay partidas'}</h2>
          <p>
            {query
              ? 'Prueba con otro nombre de partida o concepto.'
              : 'Añade una partida para organizar sus conceptos.'}
          </p>
        </div>
      )}

      <ConfirmModal
        open={!!partToDelete}
        onClose={() => setPartToDelete(null)}
        title="¿Eliminar partida?"
        message={`Se eliminará «${partToDelete?.name ?? ''}» y sus ${partToDelete?.concepts.length ?? 0} conceptos del catálogo. Los presupuestos ya creados conservarán sus datos.`}
        confirmLabel="Eliminar partida"
        onConfirm={() => {
          if (partToDelete) removePart(partToDelete.id, catalog.id);
          setPartToDelete(null);
        }}
      />
      <Modal
        open={showTradeImporter}
        onClose={() => setShowTradeImporter(false)}
        title="Importar por categoría"
        panelClassName="category-import-panel max-w-3xl"
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Importar por categoría</h2>
            <p className="mt-1 text-sm text-gray-600">
              Explora una categoría y elige cuánto quieres incorporar.
            </p>
          </div>
          <Button
            variant="ghost"
            aria-label="Cerrar importador"
            onClick={() => setShowTradeImporter(false)}
          >
            <X size={18} />
          </Button>
        </div>

        <p className="shrink-0 text-sm leading-6 text-gray-600">
          Estas categorías pueden servirte de inspiración: puedes añadir y personalizar más partidas
          y conceptos según tu forma de trabajar.
        </p>
        <p className="mt-3 shrink-0 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-5 text-gray-700">
          Todo lo que importes se añadirá al catálogo de tu empresa para utilizarlo en tus
          presupuestos.
        </p>

        {!selectedCategory && (
          <label className="mb-3 mt-4 block shrink-0 text-sm font-medium text-gray-700">
            Buscar categoría
            <span className="relative mt-1 block">
              <Search
                size={15}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                aria-label="Buscar categoría"
                value={categoryQuery}
                onChange={(event) => setCategoryQuery(event.target.value)}
                placeholder="Albañilería, fontanería, electricidad…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
              />
            </span>
          </label>
        )}

        {importMessage && showTradeImporter && (
          <p role="status" className="my-3 shrink-0 text-sm text-green-800">
            {importMessage}
          </p>
        )}

        {selectedCategory && (
          <>
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                aria-label="Volver a categorías"
                onClick={() => setSelectedTradeId(null)}
              >
                <ArrowLeft size={16} /> Categorías
              </Button>
              <Button
                aria-label={`Importar categoría ${selectedCategory.name}`}
                onClick={() => submitCategoryImport(selectedCategory, { type: 'category' })}
              >
                <Download size={15} /> Importar categoría
              </Button>
            </div>
            <div className="mb-3 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">{selectedCategory.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{selectedCategory.description}</p>
              <p className="mt-2 text-xs text-gray-500">
                {selectedCategoryParts.length} partidas · {selectedCategory.tariffs.length}{' '}
                conceptos
              </p>
            </div>
          </>
        )}

        <div data-category-import-scroll className="min-h-0 flex-1 overflow-y-auto pr-1">
          {selectedCategory ? (
            <div>
              <div className="space-y-2 py-1">
                {selectedCategoryParts.map((part) => {
                  const partKey = normalizeCatalogText(part.name);
                  const isExpanded = expandedTradeParts.has(partKey);
                  const existingPart = catalog.parts.find(
                    (item) => normalizeCatalogText(item.name) === partKey,
                  );
                  const importedConcepts = part.concepts.filter((concept) =>
                    existingPart?.concepts.some(
                      (item) =>
                        item.unit === concept.unit &&
                        normalizeCatalogText(item.description) ===
                          normalizeCatalogText(concept.description),
                    ),
                  ).length;
                  const partIsImported = importedConcepts === part.concepts.length;
                  return (
                    <section key={partKey} className="overflow-hidden rounded-lg bg-gray-50">
                      <div className="grid grid-cols-1 items-center gap-2 p-2 min-[640px]:grid-cols-[minmax(0,1fr)_auto]">
                        <button
                          type="button"
                          aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} conceptos de ${part.name}`}
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedTradeParts((previous) => {
                              const next = new Set(previous);
                              if (next.has(partKey)) next.delete(partKey);
                              else next.add(partKey);
                              return next;
                            })
                          }
                          className="grid min-h-10 min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-x-2 rounded-md px-2 text-left hover:bg-white min-[640px]:flex"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span className="min-w-0 text-sm font-semibold text-gray-800 min-[640px]:flex-1">
                            {part.name}
                          </span>
                          <span className="col-start-2 text-xs text-gray-500 min-[640px]:whitespace-nowrap">
                            {part.concepts.length}{' '}
                            {part.concepts.length === 1 ? 'concepto' : 'conceptos'}
                          </span>
                        </button>
                        <Button
                          variant="secondary"
                          disabled={partIsImported}
                          className="justify-self-start min-[640px]:col-start-2 min-[640px]:row-start-1 min-[640px]:justify-self-auto"
                          aria-label={`${partIsImported ? 'Partida importada' : 'Importar partida'} ${part.name}`}
                          onClick={() =>
                            submitCategoryImport(selectedCategory, {
                              type: 'part',
                              partName: part.name,
                            })
                          }
                        >
                          {partIsImported ? <Check size={15} /> : <Download size={15} />}
                          {partIsImported ? 'En catálogo' : 'Importar partida'}
                        </Button>
                      </div>
                      {isExpanded && (
                        <ul className="space-y-1 px-3 pb-3">
                          {part.concepts.map((concept) => {
                            const isImported = existingPart?.concepts.some(
                              (item) =>
                                item.unit === concept.unit &&
                                normalizeCatalogText(item.description) ===
                                  normalizeCatalogText(concept.description),
                            );
                            return (
                              <li
                                key={`${normalizeCatalogText(concept.description)}-${concept.unit}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2"
                              >
                                <span className="min-w-0 flex-1 text-sm text-gray-700">
                                  {concept.description}
                                  <span className="ml-2 text-xs text-gray-500">
                                    {UNIT_LABELS[concept.unit]}
                                  </span>
                                </span>
                                <Button
                                  variant="ghost"
                                  disabled={isImported}
                                  aria-label={`${isImported ? 'Concepto importado' : 'Importar concepto'} ${concept.description}`}
                                  onClick={() =>
                                    submitCategoryImport(selectedCategory, {
                                      type: 'concept',
                                      partName: part.name,
                                      description: concept.description,
                                      unit: concept.unit,
                                    })
                                  }
                                >
                                  {isImported ? <Check size={15} /> : <Download size={15} />}
                                  {isImported ? 'En catálogo' : 'Importar'}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
              <p className="mt-4 text-sm leading-5 text-gray-600">
                Las unidades y tarifas iniciales se pueden editar después. Los elementos que ya
                tengas se conservan.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-1">
              {filteredCategories.map((category) => {
                const parts = getTradeParts(category);
                return (
                  <article
                    key={category.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">{category.name}</h3>
                      <p className="mt-1 text-sm text-gray-600">{category.description}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {parts.length} partidas · {category.tariffs.length} conceptos
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        aria-label={`Ver detalle ${category.name}`}
                        onClick={() => {
                          setSelectedTradeId(category.id);
                          setExpandedTradeParts(new Set());
                        }}
                      >
                        Ver detalle
                      </Button>
                      <Button
                        aria-label={`Importar categoría ${category.name}`}
                        onClick={() => submitCategoryImport(category, { type: 'category' })}
                      >
                        <Download size={15} /> Importar categoría
                      </Button>
                    </div>
                  </article>
                );
              })}
              {filteredCategories.length === 0 && (
                <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                  No hay categorías que coincidan con esa búsqueda.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </PageLayout>
  );
}

export function CatalogDetailPage() {
  const loaded = useCatalogStore((state) => state.loaded);
  const catalog = useCatalogStore((state) => state.catalogs[0]);
  if (!loaded || !catalog)
    return (
      <PageLayout>
        <PageHeaderSkeleton />
        <CatalogSkeleton />
      </PageLayout>
    );
  return <CatalogEditor key={catalog.id} catalog={catalog} />;
}
