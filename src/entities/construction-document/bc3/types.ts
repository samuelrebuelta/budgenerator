export type Bc3DiagnosticCode =
  | 'empty-file'
  | 'missing-header'
  | 'unsupported-version'
  | 'unsupported-information-type'
  | 'unsupported-character-set'
  | 'invalid-record'
  | 'truncated-file'
  | 'duplicate-concept'
  | 'unknown-concept-reference'
  | 'invalid-number'
  | 'invalid-structure'
  | 'unsupported-record'
  | 'extension-records'
  | 'measurement-mismatch'
  | 'price-mismatch'
  | 'total-mismatch'
  | 'unused-concepts'
  | 'multiple-prices'
  | 'global-percentages'
  | 'default-vat'
  | 'kind-mismatch'
  | 'too-large';

export interface Bc3Diagnostic {
  code: Bc3DiagnosticCode;
  /** `error` blocks the import; `warning` must be shown in the preview. */
  severity: 'error' | 'warning';
  message: string;
  recordType?: string;
  /** 1-based record number in the file. */
  recordIndex?: number;
}

export interface Bc3Summary {
  informationType: 1 | 2 | null;
  version: string;
  program: string;
  title: string;
  charset: string;
  records: number;
  concepts: number;
  chapters: number;
  items: number;
  measuredItems: number;
  composedConcepts: number;
  extensionTypes: string[];
  /** Total declared by the root concept of a work file, when present. */
  declaredTotal: number | null;
  /** Execution total (PEM) recomputed by the app. */
  computedTotal: number | null;
}
