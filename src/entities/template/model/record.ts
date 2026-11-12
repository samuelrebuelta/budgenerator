import { projectWorkItems, type ConstructionDocument } from '@/entities/construction-document/model';
import type { BudgetTemplate } from '@/shared/types';

export interface TemplateRecord {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  document: ConstructionDocument;
}

const cache = new WeakMap<TemplateRecord, BudgetTemplate>();

/** Derived template view; never persisted. */
export function templateView(record: TemplateRecord): BudgetTemplate {
  const cached = cache.get(record);
  if (cached) return cached;
  const { business } = record.document;
  const view: BudgetTemplate = {
    id: record.id,
    name: business.name,
    workItems: projectWorkItems(record.document),
    ivaRate: business.ivaRate,
    ...(business.adjustment ? { adjustment: { ...business.adjustment } } : {}),
    createdAt: record.createdAt,
  };
  cache.set(record, view);
  return view;
}
