import { memo, useMemo, useState } from 'react';
import { ListPlus, Search, X } from 'lucide-react';
import { useActiveBudget, useBudgetStore } from '@/entities/budget';
import { getCatalogContent, searchTariffs, useCatalogView } from '@/entities/catalog';
import { Modal, Button } from '@/shared/ui';
import { unitLabel } from '@/shared/types';
interface CatalogSelectorProps {
  workItemId: string;
  taskId: string;
  workItemName: string;
}
export const CatalogSelector = memo(function CatalogSelector({
  workItemId,
  taskId,
  workItemName,
}: CatalogSelectorProps) {
  const { tariffs, parts } = useCatalogView();
  const budget = useActiveBudget();
  const workItem = budget?.workItems.find((item) => item.id === workItemId);
  const catalogPartId =
    workItem?.catalogPartId ?? parts.find((part) => part.name === workItemName)?.id;
  const partName = parts.find((part) => part.id === catalogPartId)?.name;
  const partTariffs = tariffs.filter((tariff) => tariff.partId === catalogPartId);
  const applyCatalogConcept = useBudgetStore((s) => s.applyCatalogConcept);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTariffs(partTariffs, query), [partTariffs, query]);
  return (
    <>
      <button
        type="button"
        className="catalog-picker-trigger no-print"
        aria-label="Aplicar tarifa del catálogo"
        disabled={!partTariffs.length}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <ListPlus size={16} />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Buscar en el catálogo"
        panelClassName="catalog-picker-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Buscar en el catálogo</h2>
            <p className="text-sm text-gray-500 mt-1">
              Elige una partida del capítulo {partName || workItemName || 'actual'}.
            </p>
          </div>
          <Button variant="ghost" aria-label="Cerrar" onClick={() => setOpen(false)}>
            <X size={18} />
          </Button>
        </div>
        <label className="catalog-search mt-4">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            aria-label="Buscar partidas del capítulo"
            placeholder="Buscar partida"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <p className="text-xs text-gray-500 my-3" role="status">
          {results.length} partidas
        </p>
        <div className="catalog-picker-results">
          {results.map((tariff) => (
            <button
              key={tariff.id}
              type="button"
              className="catalog-picker-result"
              onClick={() => {
                const catalog = getCatalogContent();
                if (catalog) applyCatalogConcept(taskId, catalog, tariff.id, tariff.partId);
                setOpen(false);
              }}
            >
              <span>
                <strong>{tariff.description}</strong>
                <small>{tariff.category}</small>
              </span>
              <span>
                {tariff.basePrice.toLocaleString('es-ES')} €/{unitLabel(tariff.unit)}
              </span>
            </button>
          ))}
          {!results.length && (
            <p className="py-6 text-sm text-gray-500">
              No hay coincidencias en este capítulo. Prueba otra descripción.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
});
