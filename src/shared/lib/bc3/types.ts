export type Bc3DiagnosticCode =
  | 'empty-file'
  | 'missing-header'
  | 'unsupported-version'
  | 'unsupported-information-type'
  | 'invalid-record'
  | 'duplicate-concept'
  | 'unknown-concept-reference'
  | 'invalid-number'
  | 'invalid-text-encoding'
  | 'unsupported-record'
  | 'unsupported-character-set';

export interface Bc3Diagnostic {
  code: Bc3DiagnosticCode;
  message: string;
  recordType?: string;
  recordIndex?: number;
  fatal: boolean;
}
