import { memo, useMemo } from 'react';
import { ListPlus } from 'lucide-react';
import { useActiveBudget, useBudgetStore } from '@/entities/budget';
import { useCatalogStore, RENOVATION_CATEGORIES } from '@/entities/catalog';
import { t } from '@/shared/i18n';

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
  const applyTariff = useBudgetStore((s) => s.applyTariff);
  const catalogs = useCatalogStore((s) => s.catalogs);
  const activeCatalogId = useCatalogStore((s) => s.activeCatalogId);
  const activeBudget = useActiveBudget();

  const selectedCatalogId = activeBudget?.catalogId ?? activeCatalogId;
  const tariffs = useMemo(() => {
    if (!selectedCatalogId) return [];
    return catalogs.find((catalog) => catalog.id === selectedCatalogId)?.tariffs ?? [];
  }, [catalogs, selectedCatalogId]);

  const { matched, grouped } = useMemo(() => {
    const catOrder = new Map<string, number>(RENOVATION_CATEGORIES.map((c, i) => [c, i]));
    const nameNorm = workItemName.trim().toLowerCase();

    const matchedCat = [...new Set(tariffs.map((t) => t.category))].find(
      (c) => c.toLowerCase() === nameNorm,
    );

    if (matchedCat) {
      const items = tariffs.filter((t) => t.category === matchedCat);
      return { matched: matchedCat, grouped: [[matchedCat, items]] as [string, typeof tariffs][] };
    }

    const map = new Map<string, typeof tariffs>();
    for (const tariff of tariffs) {
      const list = map.get(tariff.category) ?? [];
      list.push(tariff);
      map.set(tariff.category, list);
    }

    const sorted = [...map.entries()].sort(([a], [b]) => {
      const ia = catOrder.get(a) ?? 999;
      const ib = catOrder.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'es');
    });

    return { matched: null, grouped: sorted };
  }, [tariffs, workItemName]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tariffId = e.target.value;
    if (!tariffId) return;
    const tariff = tariffs.find((t) => t.id === tariffId);
    if (!tariff) return;
    applyTariff(workItemId, taskId, tariff.description, tariff.unit, tariff.basePrice, tariff.cost);
    e.target.value = '';
  };

  return (
    <div className="relative shrink-0 no-print">
      <select
        onChange={handleSelect}
        defaultValue=""
        disabled={tariffs.length === 0}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="" disabled>
          {t('catalogSelector.placeholder')}
        </option>
        {matched
          ? grouped[0]?.[1].map((tariff) => (
              <option key={tariff.id} value={tariff.id}>
                {tariff.description} — {tariff.basePrice}€/{tariff.unit}
              </option>
            ))
          : grouped.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((tariff) => (
                  <option key={tariff.id} value={tariff.id}>
                    {tariff.description} — {tariff.basePrice}€/{tariff.unit}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
      <div className="pointer-events-none flex items-center rounded-md border border-gray-300 bg-gray-50 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
        <ListPlus size={14} />
      </div>
    </div>
  );
});
