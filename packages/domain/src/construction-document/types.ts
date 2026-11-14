/**
 * Canonical FIEBDC-3 (BC3) domain model. Budgets, templates and the account catalog persist
 * exactly this structure; every UI shape is a pure projection computed from it.
 *
 * Files under `model/` are shared with Cloud Functions: keep relative imports with `.js`
 * extensions and never import browser, Firebase or `@/` aliases from here.
 */
export type ConstructionDocumentKind = 'catalog' | 'budget' | 'template';

export const CONSTRUCTION_SCHEMA_VERSION = 1 as const;

/**
 * Decimal lexeme in FIEBDC notation (`.` as separator). Values stay as text so imported
 * precision is exported unchanged; arithmetic converts them on demand.
 */
export type DecimalText = string;

/** FIEBDC information types handled by the app: 1 = price base, 2 = budget/work. */
export type FiebdcInformationType = 1 | 2;

export interface FiebdcHeader {
  /** PROPIEDAD_ARCHIVO */
  owner: string;
  /** VERSION_FORMATO, for example `FIEBDC-3/2020`. */
  version: string;
  /** Optional DDMMAAAA date attached to the version. */
  versionDate?: string;
  /** PROGRAMA_EMISION */
  program: string;
  /** CABECERA */
  title: string;
  /** ROTULO_IDENTIFICACION list, one per price column. */
  priceLabels: string[];
  /** Character set declared by the source file. Exports always use ANSI (Windows-1252). */
  charset: string;
  comment: string;
  informationType: FiebdcInformationType;
  baseUrl?: string;
}

/** ~K record: rounding policy and global percentages. */
export interface FiebdcSettings {
  currency: string;
  decimals: {
    /** Measurement totals (DS). */
    quantity: number;
    /** Decomposition factor/yield (DR). */
    yield: number;
    /** Unit price of composed concepts (DC / DEC). */
    price: number;
    /** Line amounts (DI). */
    amount: number;
  };
  /** Percentages as written in FIEBDC (13 = 13 %). */
  percentages: {
    indirect: DecimalText;
    general: DecimalText;
    profit: DecimalText;
    discount: DecimalText;
    vat: DecimalText;
  };
  /** Original ~K text, reused on export to keep fields the app does not interpret. */
  sourceRecord?: string;
}

export interface FiebdcDecompositionLine {
  /** Internal concept ID (not the FIEBDC code). */
  conceptId: string;
  /** Empty text means the FIEBDC default (1). */
  factor: DecimalText;
  yield: DecimalText;
  /** CODIGO_PORCENTAJE masks of the FIEBDC-3/2002+ quadruple format. */
  percentageCodes?: string[];
}

export interface FiebdcConcept {
  /** Stable internal ID; never derived from the FIEBDC code. */
  id: string;
  /** Primary FIEBDC code, including the `#`/`##` chapter and root markers. */
  code: string;
  /** Additional codes listed in the same ~C record. */
  synonyms?: string[];
  /** Literal unit. Free text; known units only drive labels and the estimator. */
  unit: string;
  summary: string;
  /** One price per header label. The first one is the sale price used by the app. */
  prices: DecimalText[];
  dates: string[];
  /** TIPO field (0 unclassified, 1 labour, 2 machinery, 3 material…). */
  type: string;
  /** ~T long description. */
  text?: string;
  /** Price breakdown. Structural children of chapters live in the node tree instead. */
  decomposition: FiebdcDecompositionLine[];
  /** BudGenerator private extension: internal unit cost. Never exported or shared. */
  cost?: DecimalText;
  /** BudGenerator private extension: catalog origin of a copied concept. */
  source?: { catalogConceptId?: string; catalogChapterId?: string };
}

/** Measurement line type: '' normal, '1' partial subtotal, '2' running subtotal, '3' expression. */
export type FiebdcMeasurementLineType = '' | '1' | '2' | '3';

export interface FiebdcMeasurementLine {
  type: FiebdcMeasurementLineType;
  comment: string;
  bimIds?: string[];
  units?: DecimalText;
  length?: DecimalText;
  width?: DecimalText;
  height?: DecimalText;
}

export interface FiebdcMeasurement {
  /** POSICION path as written in the source file. */
  position?: string;
  /** MEDICION_TOTAL as written in the source file, used to validate the lines. */
  total?: DecimalText;
  label?: string;
  lines: FiebdcMeasurementLine[];
}

/** One occurrence of a concept inside the work structure (root → chapters → items). */
export interface FiebdcNode {
  id: string;
  conceptId: string;
  /** FACTOR of the parent ~D line. Empty means 1. */
  factor: DecimalText;
  /** RENDIMIENTO of the parent ~D line: the measured quantity of an item. */
  quantity: DecimalText;
  /** Optional detailed measurement (~M). When it has lines, its total drives the quantity. */
  measurement?: FiebdcMeasurement;
  children: FiebdcNode[];
}

/** Records the app does not interpret, kept verbatim and in order for export. */
export interface FiebdcExtensionRecord {
  type: string;
  raw: string;
}

export interface BudgetAdjustmentValue {
  /** 1 = no change, 1.1 = +10 %, 0.9 = -10 %. */
  multiplier: number;
  reason: string;
}

/** Business metadata with no exact FIEBDC field; persisted on the root Firestore document. */
export interface ConstructionBusiness {
  /** Template or catalog name. Budgets use the address as title. */
  name: string;
  clientName: string;
  address: string;
  date: string;
  budgetNumber: string;
  ivaRate: number;
  adjustment?: BudgetAdjustmentValue;
}

/** The FIEBDC content, stored in content chunks. */
export interface ConstructionContent {
  schemaVersion: typeof CONSTRUCTION_SCHEMA_VERSION;
  kind: ConstructionDocumentKind;
  header: FiebdcHeader;
  settings: FiebdcSettings;
  /** The `##` root concept. The node tree is its structural decomposition. */
  rootConceptId: string;
  concepts: Record<string, FiebdcConcept>;
  tree: FiebdcNode[];
  extensions: FiebdcExtensionRecord[];
}

export interface ConstructionDocument extends ConstructionContent {
  business: ConstructionBusiness;
}

export interface ConstructionDocumentIssue {
  code:
    | 'duplicate-concept-code'
    | 'unknown-concept-reference'
    | 'cyclic-decomposition'
    | 'duplicate-node-id'
    | 'invalid-concept-id'
    | 'invalid-number'
    | 'missing-root'
    | 'invalid-structure';
  message: string;
  codeReference?: string;
}
