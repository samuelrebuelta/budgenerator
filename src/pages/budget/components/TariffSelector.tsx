import { memo, useMemo } from 'react';
import { useBudgetStore } from '@/entities/budget';
import { useTariffStore, RENOVATION_CATEGORIES } from '@/entities/tariff';

interface TariffSelectorProps {
  sectionId: string;
  rowId: string;
  sectionName: string;
}

export const TariffSelector = memo(function TariffSelector({ sectionId, rowId, sectionName }: TariffSelectorProps) {
  const applyTariff = useBudgetStore((s) => s.applyTariff);
  const tariffs = useTariffStore((s) => s.tariffs);

  const { matched, grouped } = useMemo(() => {
    const catOrder = new Map<string, number>(RENOVATION_CATEGORIES.map((c, i) => [c, i]));
    const nameNorm = sectionName.trim().toLowerCase();

    // Check if the section name matches a catalog category
    const matchedCat = [...new Set(tariffs.map((t) => t.category))].find(
      (c) => c.toLowerCase() === nameNorm,
    );

    if (matchedCat) {
      const items = tariffs.filter((t) => t.category === matchedCat);
      return { matched: matchedCat, grouped: [[matchedCat, items]] as [string, typeof tariffs][] };
    }

    // No match: show all grouped
    const map = new Map<string, typeof tariffs>();
    for (const t of tariffs) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => {
      const ia = catOrder.get(a) ?? 999;
      const ib = catOrder.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'es');
    });
    return { matched: null, grouped: sorted };
  }, [tariffs, sectionName]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tariffId = e.target.value;
    if (!tariffId) return;
    const tariff = tariffs.find((t) => t.id === tariffId);
    if (!tariff) return;
    applyTariff(sectionId, rowId, tariff.description, tariff.unit, tariff.basePrice, tariff.cost);
    e.target.value = '';
  };

  return (
    <select
      onChange={handleSelect}
      defaultValue=""
      className="shrink-0 w-9 rounded border border-dashed border-blue-300 bg-blue-50 px-1.5 py-1 text-xs text-blue-600 outline-none cursor-pointer appearance-none text-center no-print"
    >
      <option value="" disabled>
        📋
      </option>
      {matched ? (
        grouped[0]?.[1].map((t) => (
          <option key={t.id} value={t.id}>
            {t.description} — {t.basePrice}€/{t.unit}
          </option>
        ))
      ) : (
        grouped.map(([cat, items]) => (
          <optgroup key={cat} label={cat}>
            {items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.description} — {t.basePrice}€/{t.unit}
              </option>
            ))}
          </optgroup>
        ))
      )}
    </select>
  );
});
