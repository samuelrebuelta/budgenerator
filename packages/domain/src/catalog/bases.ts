import {
  addCatalogConcept,
  addChapter,
  createEmptyDocument,
  findChapterByName,
  type ConstructionDocument,
} from '../construction-document/index.js';
import { normalizeUnit } from '../types/index.js';
import type { BaseCatalog } from './baseCatalogs';

const cache = new Map<string, ConstructionDocument>();

/**
 * Built-in libraries are static seed data; this builds their canonical FIEBDC document
 * (chapters by category, literal units) so seeding and trade imports use the same model.
 */
export function baseCatalogDocument(base: BaseCatalog): ConstructionDocument {
  const cached = cache.get(base.id);
  if (cached) return cached;
  let document = createEmptyDocument('catalog', { name: base.name });
  for (const tariff of base.tariffs) {
    const category = tariff.category.trim() || base.name;
    let chapter = findChapterByName(document, category);
    if (!chapter) {
      const added = addChapter(document, category);
      document = added.document;
      chapter = findChapterByName(document, category)!;
    }
    document = addCatalogConcept(document, chapter.id, {
      description: tariff.description,
      unit: normalizeUnit(tariff.unit),
      price: tariff.basePrice,
      cost: tariff.cost,
    }).document;
  }
  cache.set(base.id, document);
  return document;
}
