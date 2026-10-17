import type { CatalogPart } from '@/shared/types';
import type { Unit } from '@/shared/types';
import { generateId } from '@/shared/lib';
import type { BaseCatalog } from './baseCatalogs';
import { compareSpanish, normalizeCatalogText } from './search';

export type TradeImportScope =
  | { type: 'category' }
  | { type: 'part'; partName: string }
  | { type: 'concept'; partName: string; description: string; unit: Unit };

export interface TradeImportResult {
  parts: CatalogPart[];
  addedParts: number;
  addedConcepts: number;
}

export function mergeTradeIntoParts(
  existingParts: readonly CatalogPart[],
  trade: BaseCatalog,
  createId: () => string = generateId,
  scope: TradeImportScope = { type: 'category' },
): TradeImportResult {
  const parts = existingParts.map((part) => ({ ...part, concepts: [...part.concepts] }));
  let addedParts = 0;
  let addedConcepts = 0;

  const scopedTariffs = trade.tariffs.filter((tariff) => {
    if (scope.type === 'category') return true;
    const partMatches =
      normalizeCatalogText(tariff.category || trade.name) === normalizeCatalogText(scope.partName);
    if (!partMatches || scope.type === 'part') return partMatches;
    return (
      tariff.unit === scope.unit &&
      normalizeCatalogText(tariff.description) === normalizeCatalogText(scope.description)
    );
  });

  for (const tariff of scopedTariffs) {
    const partName = tariff.category.trim() || trade.name;
    const normalizedPartName = normalizeCatalogText(partName);
    let part = parts.find((item) => normalizeCatalogText(item.name) === normalizedPartName);

    if (!part) {
      part = { id: createId(), name: partName, concepts: [] };
      parts.push(part);
      addedParts += 1;
    }

    const normalizedDescription = normalizeCatalogText(tariff.description);
    const alreadyPresent = part.concepts.some(
      (concept) =>
        concept.unit === tariff.unit &&
        normalizeCatalogText(concept.description) === normalizedDescription,
    );
    if (alreadyPresent) continue;

    part.concepts.push({
      id: createId(),
      description: tariff.description,
      unit: tariff.unit,
      basePrice: tariff.basePrice,
      cost: tariff.cost,
    });
    addedConcepts += 1;
  }

  return {
    parts: parts.sort((a, b) => compareSpanish(a.name, b.name)),
    addedParts,
    addedConcepts,
  };
}
