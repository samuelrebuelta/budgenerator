import type { CatalogPart, Tariff } from '../types/index.js';
import { compareSpanish, normalizeCatalogText } from '../lib/text.js';

export { compareSpanish, normalizeCatalogText };
export function searchTariffs(tariffs: readonly Tariff[], query: string): Tariff[] {
  const words = normalizeCatalogText(query).split(/\s+/).filter(Boolean);
  return tariffs
    .filter((t) =>
      words.every((word) => normalizeCatalogText(`${t.description} ${t.category}`).includes(word)),
    )
    .sort(
      (a, b) =>
        compareSpanish(a.description, b.description) ||
        compareSpanish(a.category, b.category) ||
        a.id.localeCompare(b.id),
    );
}

export function searchCatalogParts(parts: readonly CatalogPart[], query: string): CatalogPart[] {
  const words = normalizeCatalogText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...parts].sort((a, b) => compareSpanish(a.name, b.name));
  return parts
    .map((part) => {
      const partMatches = words.every((word) => normalizeCatalogText(part.name).includes(word));
      const concepts = part.concepts.filter(
        (concept) =>
          partMatches ||
          words.every((word) => normalizeCatalogText(concept.description).includes(word)),
      );
      return { ...part, concepts };
    })
    .filter(
      (part) =>
        words.every((word) => normalizeCatalogText(part.name).includes(word)) ||
        part.concepts.length > 0,
    )
    .sort((a, b) => compareSpanish(a.name, b.name));
}
