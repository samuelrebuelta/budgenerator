/** Pure fixtures shared by the domain tests and the web/rules tests in `tests/`. */
import {
  addChapter,
  addItem,
  contentOf,
  createEmptyDocument,
  encodeContent,
  type ConstructionDocument,
  type ConstructionDocumentKind,
} from '../src/construction-document/index';
import { budgetView, type BudgetRecord } from '../src/budget/record';
import type { Budget, UserData } from '../src/types/index';

/** Canonical document with one chapter («Pintura») and one item (2.5 m² × 10.75 €, cost 4.5). */
export function sampleDocument(
  kind: ConstructionDocumentKind = 'budget',
  business: Partial<ConstructionDocument['business']> = {},
): ConstructionDocument {
  let document = createEmptyDocument(kind, {
    clientName: kind === 'budget' ? 'Estudio de prueba' : '',
    address: kind === 'budget' ? 'Proyecto de demostración' : '',
    date: '2026-10-14',
    budgetNumber: kind === 'budget' ? '1' : '',
    name: kind === 'budget' ? '' : 'Base de prueba',
    ...business,
  });
  const chapter = addChapter(document, 'Pintura');
  document = addItem(chapter.document, chapter.chapterId, {
    description: kind === 'catalog' ? 'Original' : 'Pintura de paredes',
    quantity: kind === 'catalog' ? 1 : 2.5,
    unit: 'm2',
    price: 10.75,
    cost: 4.5,
  }).document;
  return document;
}

export function budgetRecord(id = 'budget-a', patch: Partial<BudgetRecord> = {}): BudgetRecord {
  return {
    id,
    revision: 1,
    number: 1,
    createdAt: '2026-10-14T10:00:00Z',
    updatedAt: '2026-10-14T10:00:00Z',
    document: sampleDocument('budget'),
    ...patch,
  };
}

/** Derived view of the sample budget. */
export const budget = (id = 'budget-a'): Budget => budgetView(budgetRecord(id));

export const user = (uid = 'alice'): UserData => ({
  uid,
  email: `${uid}@example.test`,
  accountData: { isAdmin: false, plan: 'free' },
  totalBudgetsCreated: 0,
  budgetSlotsReleased: 0,
  createdAt: '2026-10-14T10:00:00Z',
});

/** Root fields as written by `api/storage` for a stored document. */
export function storedRoot(
  id: string,
  document: ConstructionDocument,
  extra: Record<string, unknown> = {},
) {
  const { business } = document;
  return {
    id,
    kind: document.kind,
    schemaVersion: 1,
    revision: 1,
    contentRevision: 1,
    chunkCount: encodeContent(contentOf(document)).length,
    createdAt: '2026-10-14T10:00:00Z',
    updatedAt: '2026-10-14T10:00:00Z',
    name: business.name,
    clientName: business.clientName,
    address: business.address,
    date: business.date,
    budgetNumber: business.budgetNumber,
    ivaRate: business.ivaRate,
    ...(business.adjustment ? { adjustment: business.adjustment } : {}),
    ...extra,
  };
}
