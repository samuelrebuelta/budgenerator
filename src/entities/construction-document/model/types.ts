export type ConstructionDocumentKind = 'catalog' | 'budget' | 'template';

export type FiebdcInformationType = 1 | 2;

/** The original lexeme is kept so decimal precision and separator survive export. */
export interface FiebdcDecimal {
  raw: string;
}

export interface FiebdcHeader {
  version: string;
  owner: string;
  program: string;
  title: string;
  characterSet: string;
  informationType: FiebdcInformationType;
  sourceDate?: string;
  comment?: string;
  priceLabels?: string[];
  certificationNumber?: string;
  certificationDate?: string;
  baseUrl?: string;
}

export interface FiebdcPrice {
  label: string;
  amount: FiebdcDecimal;
}

export interface FiebdcDecompositionLine {
  code: string;
  factor: FiebdcDecimal;
  yield: FiebdcDecimal;
  percentageCodes?: string[];
}

export interface FiebdcConcept {
  /** Stable app ID. FIEBDC codes remain in `codes` and are never used as DB paths. */
  id: string;
  codes: string[];
  type: string;
  summary: string;
  unit: string;
  prices: FiebdcPrice[];
  dates: string[];
  texts: string[];
  decomposition: FiebdcDecompositionLine[];
}

export type FiebdcMeasurementKind =
  'measurement' | 'partial-subtotal' | 'total-subtotal' | 'expression';

export interface FiebdcMeasurementLine {
  kind?: FiebdcMeasurementKind;
  /** Original FIEBDC position and measurement type when present. */
  position?: string;
  sourceType?: string;
  total?: FiebdcDecimal;
  comment?: string;
  expression?: string;
  units?: FiebdcDecimal;
  length?: FiebdcDecimal;
  breadth?: FiebdcDecimal;
  height?: FiebdcDecimal;
  bimIds?: string[];
  label?: string;
}

/** A budget occurrence points to a reusable concept while keeping its own path and measurements. */
export interface FiebdcNode {
  id: string;
  conceptCode: string;
  children: FiebdcNode[];
  measurements: FiebdcMeasurementLine[];
}

export interface FiebdcCoefficient {
  code: string;
  value: number;
}

export interface FiebdcOpaqueRecord {
  type: string;
  raw: string;
  order: number;
  referencedCodes: string[];
}

export interface ConstructionBusinessData {
  clientName?: string;
  address?: string;
  date?: string;
  budgetNumber?: string;
  ivaRate?: FiebdcDecimal;
  adjustment?: { multiplier: FiebdcDecimal; reason: string };
  acceptedAt?: string;
  projectId?: string;
  sourceLeadId?: string;
  templateName?: string;
  [key: string]: unknown;
}

export interface ConstructionDocument {
  id: string;
  schemaVersion: 1;
  kind: ConstructionDocumentKind;
  header: FiebdcHeader;
  concepts: Record<string, FiebdcConcept>;
  roots: FiebdcNode[];
  coefficients: FiebdcCoefficient[];
  opaqueRecords: FiebdcOpaqueRecord[];
  business: ConstructionBusinessData;
}

export interface ConstructionDocumentIssue {
  code:
    | 'duplicate-concept-code'
    | 'unknown-concept-reference'
    | 'cyclic-decomposition'
    | 'duplicate-node-id'
    | 'invalid-concept-id'
    | 'unsupported-information-type';
  message: string;
  codeReference?: string;
}
