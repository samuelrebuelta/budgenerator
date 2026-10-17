import { compareSpanish, normalizeCatalogText } from './search';
import type { CatalogPart, Tariff, TariffCatalog } from '@/shared/types';

export function legacyPartId(name: string): string {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const slug = normalizeCatalogText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `legacy-${slug || 'sin-nombre'}-${(hash >>> 0).toString(36)}`;
}

export function groupLegacyTariffs(tariffs: readonly Tariff[]): CatalogPart[] {
  const grouped = new Map<string, CatalogPart>();
  for (const tariff of tariffs) {
    const name = tariff.category.trim() || 'Varios';
    const id = legacyPartId(name);
    const part = grouped.get(id) ?? { id, name, concepts: [] };
    const concept = { ...tariff };
    Reflect.deleteProperty(concept, 'category');
    Reflect.deleteProperty(concept, 'partId');
    part.concepts.push(concept);
    grouped.set(id, part);
  }
  return [...grouped.values()]
    .map((part) => ({
      ...part,
      concepts: part.concepts.sort((a, b) => compareSpanish(a.description, b.description)),
    }))
    .sort((a, b) => compareSpanish(a.name, b.name));
}

export function catalogParts(catalog: Pick<TariffCatalog, 'parts' | 'tariffs'>): CatalogPart[] {
  if (catalog.parts?.length) return catalog.parts;
  return groupLegacyTariffs(catalog.tariffs ?? []);
}

export function flattenCatalogParts(parts: readonly CatalogPart[]): Tariff[] {
  return parts.flatMap((part) =>
    part.concepts.map((concept) => ({ ...concept, category: part.name, partId: part.id })),
  );
}
