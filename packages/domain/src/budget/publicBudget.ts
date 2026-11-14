import {
  CONTENT_CHUNK_BYTES,
  contentOf,
  decodeContent,
  documentTotals,
  projectWorkItems,
  toPublicContent,
  utf8ByteLength,
} from '../construction-document/index.js';
import type { CompanyProfile, PublicBudget } from '../types/index.js';
import { assertPublishable, type BudgetRecord } from './record';

/** Public snapshot: allowlisted business fields and FIEBDC content without private data. */
export interface SharedBudget {
  schemaVersion: 3;
  ownerUid: string;
  expiresAt: number;
  sharedAt: string;
  company: Omit<CompanyProfile, 'privacyPolicyUrl'>;
  budget: {
    id: string;
    clientName: string;
    address: string;
    date: string;
    budgetNumber: string;
    ivaRate: number;
    adjustment?: { multiplier: number; reason: string };
    createdAt: string;
  };
  /** Public FIEBDC content as JSON (see `toPublicContent`). */
  content: string;
}

export const SHARE_TTL_MS = 30 * 86400000;

export function buildSharedBudget(
  record: BudgetRecord,
  company: CompanyProfile,
  ownerUid: string,
  now = Date.now(),
): SharedBudget {
  assertPublishable(record);
  const totals = documentTotals(record.document);
  const business = record.document.business;
  const adjustedPrice = new Map<string, number>();
  for (const node of totals.nodes.values())
    if (!node.chapter) adjustedPrice.set(node.conceptId, node.adjustedUnitPrice);
  const content = JSON.stringify(
    toPublicContent(contentOf(record.document), (id) => adjustedPrice.get(id) ?? null),
  );
  if (utf8ByteLength(content) > CONTENT_CHUNK_BYTES)
    throw new Error('El presupuesto es demasiado grande para compartirlo por enlace.');
  const multiplier = business.adjustment?.multiplier ?? 1;
  return {
    schemaVersion: 3,
    ownerUid,
    expiresAt: now + SHARE_TTL_MS,
    sharedAt: new Date(now).toISOString(),
    company: {
      name: company.name,
      cif: company.cif,
      address: company.address,
      phone: company.phone,
      email: company.email,
      ...(company.logo ? { logo: company.logo } : {}),
    },
    budget: {
      id: record.id,
      clientName: business.clientName,
      address: business.address,
      date: business.date,
      budgetNumber: business.budgetNumber,
      ivaRate: business.ivaRate,
      ...(multiplier < 1
        ? { adjustment: { multiplier, reason: business.adjustment!.reason } }
        : {}),
      createdAt: record.createdAt,
    },
    content,
  };
}

/** Derived view of a public snapshot. Prices in the snapshot already include the adjustment. */
export function sharedBudgetView(shared: SharedBudget): PublicBudget {
  const content = decodeContent([shared.content]);
  const { budget } = shared;
  const document = {
    ...content,
    business: {
      name: '',
      clientName: budget.clientName,
      address: budget.address,
      date: budget.date,
      budgetNumber: budget.budgetNumber,
      ivaRate: budget.ivaRate,
    },
  };
  return {
    id: budget.id,
    info: {
      clientName: budget.clientName,
      address: budget.address,
      date: budget.date,
      budgetNumber: budget.budgetNumber,
    },
    createdAt: budget.createdAt,
    ivaRate: budget.ivaRate,
    ...(budget.adjustment ? { adjustment: budget.adjustment } : {}),
    workItems: projectWorkItems(document).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      depth: item.depth,
      tasks: item.tasks.map((task) => ({
        id: task.id,
        code: task.code,
        description: task.description,
        quantity: task.quantity,
        unit: task.unit,
        price: task.price,
        measured: task.measured,
        ...(task.text ? { text: task.text } : {}),
      })),
    })),
  };
}
