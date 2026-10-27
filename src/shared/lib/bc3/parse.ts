import {
  validateConstructionDocument,
  type ConstructionDocument,
  type FiebdcConcept,
  type FiebdcDecompositionLine,
  type FiebdcInformationType,
  type FiebdcNode,
} from '@/entities/construction-document/model';
import type { Bc3Diagnostic } from './types';

interface RecordLine {
  type: string;
  fields: string[];
  raw: string;
  index: number;
}

const parsedRecords = new Set(['V', 'C', 'D', 'T', 'M']);
const recordsThatChangeMeaning = new Set(['B', 'N', 'Y']);

function getDeclaredCharset(input: Uint8Array): string {
  const header = Array.from(input.slice(0, 1000), (byte) => String.fromCharCode(byte)).join('');
  return header.match(/~V\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|([^|]*)\|/)?.[1]?.trim() || '850';
}

function decode(input: Uint8Array): string | null {
  if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(3));
    } catch {
      return null;
    }
  }
  const charset = getDeclaredCharset(input).toUpperCase();
  const label =
    charset === 'ANSI'
      ? 'windows-1252'
      : charset === '850'
        ? 'ibm850'
        : charset === '437'
          ? 'ibm437'
          : null;
  if (!label) return null;
  try {
    return new TextDecoder(label, { fatal: true }).decode(input);
  } catch {
    return null;
  }
}

function parseRecord(raw: string, index: number): RecordLine | null {
  const record = raw.replace(/[\r\n]+$/, '');
  if (!record.startsWith('~') || record.length < 2) return null;
  const body = record.slice(2).replace(/^\|/, '').replace(/\|$/, '');
  return { type: record[1] ?? '', fields: body.split('|'), raw: record, index };
}

function decimal(raw: string | undefined, diagnostics: Bc3Diagnostic[], record: RecordLine) {
  const value = raw?.trim() ?? '';
  if (!value) return { raw: '0' };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    diagnostics.push({
      code: 'invalid-number',
      message: `Valor numérico FIEBDC no válido: ${value}`,
      recordType: record.type,
      recordIndex: record.index,
      fatal: true,
    });
  }
  return { raw: value };
}

function safeId(prefix: string, source: string, used: Set<string>): string {
  const slug = source.replace(/[^a-zA-Z0-9_-]/g, '_') || 'item';
  let id = `${prefix}_${slug}`;
  let suffix = 2;
  while (used.has(id)) id = `${prefix}_${slug}_${suffix++}`;
  used.add(id);
  return id;
}

function pushDiagnostic(
  diagnostics: Bc3Diagnostic[],
  code: Bc3Diagnostic['code'],
  message: string,
  record?: RecordLine,
) {
  diagnostics.push({
    code,
    message,
    ...(record ? { recordType: `~${record.type}`, recordIndex: record.index } : {}),
    fatal: true,
  });
}

export function parseBc3(input: Uint8Array): {
  document: ConstructionDocument | null;
  diagnostics: Bc3Diagnostic[];
} {
  const diagnostics: Bc3Diagnostic[] = [];
  if (!input.length)
    return {
      document: null,
      diagnostics: [{ code: 'empty-file', message: 'El archivo está vacío.', fatal: true }],
    };

  const decoded = decode(input);
  if (decoded === null)
    return {
      document: null,
      diagnostics: [
        {
          code: 'unsupported-character-set',
          message: 'La codificación declarada no está soportada o contiene bytes no válidos.',
          fatal: true,
        },
      ],
    };
  const eofIndex = decoded.indexOf(String.fromCharCode(26));
  const contents = (eofIndex < 0 ? decoded : decoded.slice(0, eofIndex)).replaceAll(
    String.fromCharCode(0),
    '',
  );
  const records = contents
    .split('~')
    .slice(1)
    .map((record, index) => parseRecord(`~${record}`, index))
    .filter((record): record is RecordLine => record !== null);
  const headerRecord = records.find((record) => record.type === 'V');
  if (!headerRecord) {
    pushDiagnostic(diagnostics, 'missing-header', 'No se encontró el registro de cabecera ~V.');
    return { document: null, diagnostics };
  }

  const headerFields = headerRecord.fields;
  const versionAndDate = (headerFields[1] ?? '').split('\\');
  const titleAndLabels = (headerFields[3] ?? '').split('\\');
  const informationType = Number(headerFields[6]);
  if (informationType === 3) {
    pushDiagnostic(
      diagnostics,
      'unsupported-information-type',
      'Las certificaciones BC3 quedan fuera de esta versión.',
      headerRecord,
    );
    return { document: null, diagnostics };
  }
  if (informationType === 4) {
    pushDiagnostic(
      diagnostics,
      'unsupported-information-type',
      'Las actualizaciones de bases BC3 no se importan como catálogos.',
      headerRecord,
    );
    return { document: null, diagnostics };
  }
  if (informationType !== 1 && informationType !== 2) {
    pushDiagnostic(
      diagnostics,
      'unsupported-information-type',
      'El tipo indicado en la cabecera FIEBDC no está soportado.',
      headerRecord,
    );
    return { document: null, diagnostics };
  }

  const version = versionAndDate[0] ?? '';
  if (!/^\d+\/\d{4}$/.test(version))
    pushDiagnostic(
      diagnostics,
      'unsupported-version',
      `Versión FIEBDC no reconocida: ${version || '(vacía)'}.`,
      headerRecord,
    );

  for (const record of records) {
    if (recordsThatChangeMeaning.has(record.type))
      pushDiagnostic(
        diagnostics,
        'unsupported-record',
        `El registro ~${record.type} modifica la estructura y aún no está soportado.`,
        record,
      );
  }

  const concepts: Record<string, FiebdcConcept> = {};
  const conceptByCode = new Map<string, FiebdcConcept>();
  const conceptIds = new Set<string>();
  for (const record of records.filter((candidate) => candidate.type === 'C')) {
    const codes = (record.fields[0] ?? '')
      .split('\\')
      .map((code) => code.trim())
      .filter(Boolean);
    const primaryCode = codes[0] ?? '';
    if (!primaryCode) {
      pushDiagnostic(diagnostics, 'invalid-record', 'El registro ~C no incluye código.', record);
      continue;
    }
    if (codes.some((code) => conceptByCode.has(code))) {
      pushDiagnostic(
        diagnostics,
        'duplicate-concept',
        `El registro ~C duplica un código de concepto: ${codes.join(', ')}.`,
        record,
      );
      continue;
    }

    const prices = (record.fields[3] ?? '')
      .split('\\')
      .filter(Boolean)
      .map((value, index) => ({
        label: titleAndLabels[index + 1] || titleAndLabels.at(-1) || 'Precio',
        amount: decimal(value, diagnostics, record),
      }));
    const concept: FiebdcConcept = {
      id: safeId('concept', primaryCode, conceptIds),
      codes,
      unit: record.fields[1] ?? '',
      summary: record.fields[2] ?? '',
      type: record.fields[5] ?? '0',
      prices,
      dates: (record.fields[4] ?? '').split('\\').filter(Boolean),
      texts: [],
      decomposition: [],
    };
    concepts[concept.id] = concept;
    codes.forEach((code) => conceptByCode.set(code, concept));
  }

  for (const record of records.filter((candidate) => candidate.type === 'D')) {
    const parentCode = record.fields[0] ?? '';
    const parent = conceptByCode.get(parentCode);
    if (!parent) {
      pushDiagnostic(
        diagnostics,
        'unknown-concept-reference',
        `~D refiere el concepto padre inexistente ${parentCode}.`,
        record,
      );
      continue;
    }
    const field = record.fields[2] || record.fields[1] || '';
    const parts = field.split('\\');
    if (parts.at(-1) === '') parts.pop();
    const decomposition: FiebdcDecompositionLine[] = [];
    for (let index = 0; index < parts.length;) {
      const code = parts[index++];
      if (!code) continue;
      const factor = parts[index++];
      const yieldValue = parts[index++];
      const percentageCodes = parts[index]?.includes(';')
        ? parts[index++]!.split(';').filter(Boolean)
        : [];
      decomposition.push({
        code,
        factor: decimal(factor || '1', diagnostics, record),
        yield: decimal(yieldValue || '1', diagnostics, record),
        ...(percentageCodes.length ? { percentageCodes } : {}),
      });
    }
    parent.decomposition = decomposition;
  }

  for (const record of records.filter((candidate) => candidate.type === 'T')) {
    const concept = conceptByCode.get(record.fields[0] ?? '');
    if (!concept) {
      pushDiagnostic(
        diagnostics,
        'unknown-concept-reference',
        `~T refiere el concepto inexistente ${record.fields[0] ?? ''}.`,
        record,
      );
      continue;
    }
    if (record.fields[1] !== undefined) concept.texts.push(record.fields[1]);
  }

  const typeValue = informationType as FiebdcInformationType;
  const nodeIds = new Set<string>();
  const roots: FiebdcNode[] = [];
  const nodesByRelation = new Map<string, FiebdcNode[]>();
  if (typeValue === 2) {
    const childCodes = new Set(
      Object.values(concepts).flatMap((concept) => concept.decomposition.map((line) => line.code)),
    );
    const buildNode = (code: string, stack: Set<string>, path: string[]): FiebdcNode | null => {
      const concept = conceptByCode.get(code);
      if (!concept) return null;
      const pathKey = [...path, code].join('\\');
      const node: FiebdcNode = {
        id: safeId('node', pathKey, nodeIds),
        conceptCode: code,
        children: [],
        measurements: [],
      };
      if (path.length) {
        const relation = `${path.at(-1)}\\${code}`;
        nodesByRelation.set(relation, [...(nodesByRelation.get(relation) ?? []), node]);
      }
      if (stack.has(code)) return node;
      const nextStack = new Set(stack).add(code);
      for (const line of concept.decomposition) {
        const child = buildNode(line.code, nextStack, [...path, code]);
        if (child) node.children.push(child);
      }
      return node;
    };
    for (const concept of Object.values(concepts)) {
      const primaryCode = concept.codes[0]!;
      if (!childCodes.has(primaryCode)) {
        const root = buildNode(primaryCode, new Set(), []);
        if (root) roots.push(root);
      }
    }
  }

  for (const record of records.filter((candidate) => candidate.type === 'M')) {
    const relationCodes = (record.fields[0] ?? '').split('\\').filter(Boolean);
    const childCode = relationCodes.at(-1) ?? '';
    const parentCode = relationCodes.length > 1 ? relationCodes.at(-2) : undefined;
    if (!conceptByCode.has(childCode) || (parentCode && !conceptByCode.has(parentCode))) {
      const missing = !conceptByCode.has(childCode) ? childCode : parentCode!;
      pushDiagnostic(
        diagnostics,
        'unknown-concept-reference',
        `~M refiere el concepto inexistente ${missing}.`,
        record,
      );
      continue;
    }
    const relationNodes = parentCode
      ? nodesByRelation.get(`${parentCode}\\${childCode}`)
      : undefined;
    if (relationNodes && relationNodes.length > 1) {
      pushDiagnostic(
        diagnostics,
        'invalid-record',
        `La relación medida ${parentCode} → ${childCode} es ambigua.`,
        record,
      );
      continue;
    }
    const node = parentCode
      ? relationNodes?.[0]
      : roots.find((candidate) => candidate.conceptCode === childCode);
    if (!node) {
      pushDiagnostic(
        diagnostics,
        'unknown-concept-reference',
        `La relación de medición ${record.fields[0]} no existe en ~D.`,
        record,
      );
      continue;
    }
    const details = (record.fields[3] ?? '').split('\\');
    const commentAndBim = details[1] ?? '';
    const bimIds = [...commentAndBim.matchAll(/#([^\s#]+)/g)].map((match) => match[1]!);
    node.measurements.push({
      ...(record.fields[1] ? { position: record.fields[1] } : {}),
      ...(details[0] ? { sourceType: details[0] } : {}),
      ...(record.fields[2] ? { total: decimal(record.fields[2], diagnostics, record) } : {}),
      ...(commentAndBim.replace(/\s*#[^\s#]+/g, '').trim()
        ? { comment: commentAndBim.replace(/\s*#[^\s#]+/g, '').trim() }
        : {}),
      ...(bimIds.length ? { bimIds } : {}),
      ...(details[2] ? { units: decimal(details[2], diagnostics, record) } : {}),
      ...(details[3] ? { length: decimal(details[3], diagnostics, record) } : {}),
      ...(details[4] ? { breadth: decimal(details[4], diagnostics, record) } : {}),
      ...(details[5] ? { height: decimal(details[5], diagnostics, record) } : {}),
      ...(record.fields[4] ? { label: record.fields[4] } : {}),
    });
  }

  const document: ConstructionDocument = {
    id: `bc3-${crypto.randomUUID()}`,
    schemaVersion: 1,
    kind: typeValue === 1 ? 'catalog' : 'budget',
    header: {
      version,
      owner: headerFields[0] ?? '',
      program: headerFields[2] ?? '',
      title: titleAndLabels[0] ?? '',
      characterSet: headerFields[4] ?? '850',
      informationType: typeValue,
      comment: headerFields[5] ?? '',
      priceLabels: titleAndLabels.slice(1),
      ...(versionAndDate[1] ? { sourceDate: versionAndDate[1] } : {}),
      ...(headerFields[7] ? { certificationNumber: headerFields[7] } : {}),
      ...(headerFields[8] ? { certificationDate: headerFields[8] } : {}),
      ...(headerFields[9] ? { baseUrl: headerFields[9] } : {}),
    },
    concepts,
    roots,
    coefficients: [],
    opaqueRecords: records
      .filter((record) => !parsedRecords.has(record.type))
      .map((record, order) => ({
        type: `~${record.type}`,
        raw: record.raw,
        order,
        referencedCodes: record.fields[0] ? [record.fields[0]] : [],
      })),
    business: {},
  };
  for (const issue of validateConstructionDocument(document))
    pushDiagnostic(
      diagnostics,
      issue.code === 'unknown-concept-reference' ? 'unknown-concept-reference' : 'invalid-record',
      issue.message,
    );
  return {
    document: diagnostics.some((diagnostic) => diagnostic.fatal) ? null : document,
    diagnostics,
  };
}
