import { walkNodes } from './invariants.js';
import {
  CONSTRUCTION_SCHEMA_VERSION,
  type ConstructionBusiness,
  type ConstructionContent,
  type ConstructionDocument,
  type ConstructionDocumentKind,
  type FiebdcConcept,
  type FiebdcHeader,
  type FiebdcSettings,
} from './types.js';

export { KNOWN_UNITS, isKnownUnit, normalizeUnit, unitLabel } from '../../../shared/types/units.js';

export const APP_PROGRAM = 'BudGenerator';
export const APP_FIEBDC_VERSION = 'FIEBDC-3/2020';

export const ROOT_CODES: Record<ConstructionDocumentKind, string> = {
  budget: 'PRESUPUESTO##',
  template: 'PLANTILLA##',
  catalog: 'CATALOGO##',
};

export function defaultSettings(): FiebdcSettings {
  return {
    currency: 'EUR',
    decimals: { quantity: 2, yield: 3, price: 2, amount: 2 },
    percentages: { indirect: '0', general: '0', profit: '0', discount: '0', vat: '0' },
  };
}

export function defaultHeader(kind: ConstructionDocumentKind, title: string): FiebdcHeader {
  return {
    owner: '',
    version: APP_FIEBDC_VERSION,
    program: APP_PROGRAM,
    title,
    priceLabels: [],
    charset: 'ANSI',
    comment: '',
    informationType: kind === 'catalog' ? 1 : 2,
  };
}

export function emptyBusiness(patch: Partial<ConstructionBusiness> = {}): ConstructionBusiness {
  return {
    name: '',
    clientName: '',
    address: '',
    date: '',
    budgetNumber: '',
    ivaRate: 0.1,
    ...patch,
  };
}

export function createConcept(
  id: string,
  code: string,
  patch: Partial<Omit<FiebdcConcept, 'id' | 'code'>> = {},
): FiebdcConcept {
  return {
    id,
    code,
    unit: '',
    summary: '',
    prices: [],
    dates: [],
    type: '0',
    decomposition: [],
    ...patch,
  };
}

export function createEmptyDocument(
  kind: ConstructionDocumentKind,
  business: Partial<ConstructionBusiness> = {},
): ConstructionDocument {
  const title =
    business.name ?? (kind === 'catalog' ? 'Mi catálogo' : kind === 'template' ? '' : '');
  const root = createConcept('c0', ROOT_CODES[kind], { summary: title });
  return {
    schemaVersion: CONSTRUCTION_SCHEMA_VERSION,
    kind,
    header: defaultHeader(kind, title),
    settings: defaultSettings(),
    rootConceptId: root.id,
    concepts: { [root.id]: root },
    tree: [],
    extensions: [],
    business: emptyBusiness(business),
  };
}

/**
 * Copies the FIEBDC content into a document of another kind (template ↔ budget). IDs and
 * codes are document-scoped, so they can be kept; only the root code and business change.
 */
export function cloneAsKind(
  document: ConstructionContent,
  kind: ConstructionDocumentKind,
  business: ConstructionBusiness,
): ConstructionDocument {
  const content = structuredClone(document);
  const root = content.concepts[content.rootConceptId];
  const title = kind === 'budget' ? business.address : business.name;
  if (root && document.kind !== kind) root.code = ROOT_CODES[kind];
  if (root) root.summary = title;
  return {
    ...content,
    kind,
    header: {
      ...content.header,
      title,
      informationType: kind === 'catalog' ? 1 : 2,
    },
    business: { ...business },
  };
}

function maxSuffix(values: Iterable<string>, pattern: RegExp) {
  let max = 0;
  for (const value of values) {
    const match = pattern.exec(value);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

/** Allocates document-scoped IDs and FIEBDC codes without collisions. */
export function createAllocator(content: ConstructionContent) {
  const nodeIds: string[] = [];
  walkNodes(content.tree, (node) => nodeIds.push(node.id));
  const conceptCodes = Object.values(content.concepts).flatMap((concept) => [
    concept.code,
    ...(concept.synonyms ?? []),
  ]);
  const usedCodes = new Set(conceptCodes.map((code) => code.replace(/#+$/, '')));
  let concept = maxSuffix(Object.keys(content.concepts), /^c(\d+)$/);
  let node = maxSuffix(nodeIds, /^n(\d+)$/);
  let chapter = maxSuffix(conceptCodes, /^C(\d+)#$/);
  let item = maxSuffix(conceptCodes, /^P(\d+)$/);
  const unique = (candidate: () => string) => {
    let code = candidate();
    while (usedCodes.has(code.replace(/#+$/, ''))) code = candidate();
    usedCodes.add(code.replace(/#+$/, ''));
    return code;
  };
  return {
    conceptId: () => `c${++concept}`,
    nodeId: () => `n${++node}`,
    chapterCode: () => unique(() => `C${String(++chapter).padStart(2, '0')}#`),
    itemCode: () => unique(() => `P${String(++item).padStart(4, '0')}`),
    /** Reuses an imported code when it is still free, otherwise allocates a new item code. */
    claimCode: (code: string, chapterCode = false) => {
      const bare = code.replace(/#+$/, '');
      if (bare && !usedCodes.has(bare)) {
        usedCodes.add(bare);
        return code;
      }
      return chapterCode
        ? unique(() => `C${String(++chapter).padStart(2, '0')}#`)
        : unique(() => `P${String(++item).padStart(4, '0')}`);
    },
  };
}

export type Allocator = ReturnType<typeof createAllocator>;
