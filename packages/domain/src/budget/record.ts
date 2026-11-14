import {
  documentTotals,
  projectWorkItems,
  type ConstructionDocument,
} from '../construction-document/index.js';
import type { Budget } from '../types/index.js';

/** Persisted budget: workflow metadata plus the canonical FIEBDC document. */
export interface BudgetRecord {
  id: string;
  /** Server revision this copy is based on (optimistic concurrency). 0 for drafts. */
  revision: number;
  /** Sequential number assigned by the server counter on creation. 0 for drafts. */
  number: number;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  projectId?: string;
  sourceLeadId?: string;
  document: ConstructionDocument;
}

const viewCache = new WeakMap<BudgetRecord, Budget>();

/** Derived, memoized view used by components, PDF and projects. Never persisted. */
export function budgetView(record: BudgetRecord): Budget {
  const cached = viewCache.get(record);
  if (cached) return cached;
  const { business } = record.document;
  const template = record.document.kind === 'template';
  const view: Budget = {
    id: record.id,
    info: {
      clientName: template ? business.name : business.clientName,
      address: business.address,
      date: business.date,
      budgetNumber: business.budgetNumber,
    },
    workItems: projectWorkItems(record.document),
    ivaRate: business.ivaRate,
    ...(business.adjustment ? { adjustment: { ...business.adjustment } } : {}),
    createdAt: record.createdAt,
    ...(record.acceptedAt ? { acceptedAt: record.acceptedAt } : {}),
    ...(record.projectId ? { projectId: record.projectId } : {}),
    ...(record.sourceLeadId ? { sourceLeadId: record.sourceLeadId } : {}),
  };
  viewCache.set(record, view);
  return view;
}

export function budgetRecordTotals(record: BudgetRecord) {
  return documentTotals(record.document);
}

/** Validation for publishing/exporting (PDF, share link, acceptance). */
export function assertPublishable(record: BudgetRecord) {
  const totals = documentTotals(record.document);
  if (!totals.valid) throw new Error(totals.issues[0]?.message ?? 'Revisa el presupuesto.');
  const view = budgetView(record);
  let populated = 0;
  for (const item of view.workItems)
    for (const task of item.tasks) {
      if (task.description.trim() && task.quantity > 0) populated++;
      else throw new Error('Completa o elimina las partidas vacías antes de compartir o exportar.');
    }
  if (!view.info.clientName.trim() || populated === 0)
    throw new Error('Añade un cliente y al menos una partida antes de compartir o exportar.');
}
