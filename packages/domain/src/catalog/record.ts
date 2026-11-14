import { projectCatalogParts, type ConstructionDocument } from '../construction-document/index.js';
import type { CatalogPart, Tariff } from '../types/index.js';

export interface CatalogRecord {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  document: ConstructionDocument;
}

/** Derived catalog view used by components; never persisted. */
export interface CatalogView {
  id: string;
  name: string;
  parts: CatalogPart[];
  tariffs: Tariff[];
}

const cache = new WeakMap<ConstructionDocument, CatalogView>();

export function catalogView(record: CatalogRecord): CatalogView {
  const cached = cache.get(record.document);
  if (cached) return cached;
  const parts = projectCatalogParts(record.document);
  const view: CatalogView = {
    id: record.id,
    name: record.document.business.name,
    parts,
    tariffs: parts.flatMap((part) =>
      part.concepts.map((concept) => ({ ...concept, category: part.name, partId: part.id })),
    ),
  };
  cache.set(record.document, view);
  return view;
}
