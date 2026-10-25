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

// Records outside the typed profile are kept byte-for-byte as opaque records.
const parsedRecords = new Set(['V', 'C', 'D', 'T', 'M']);

function decode(input: Uint8Array): string {
  if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf)
    return new TextDecoder('utf-8').decode(input.subarray(3));
  try {
    return new TextDecoder('windows-1252', { fatal: true }).decode(input);
  } catch {
    return new TextDecoder('utf-8').decode(input);
  }
}

function splitRecord(raw: string, index: number): RecordLine | null {
  if (!raw.startsWith('~') || raw.length < 2) return null;
  const type = raw[1] ?? '';
  const body = raw.slice(2).replace(/^\|/, '').replace(/\|$/, '');
  return { type, fields: body.split('|'), raw, index };
}

function parseDecimal(raw: string | undefined, diagnostics: Bc3Diagnostic[], record: RecordLine) {
  const value = raw?.trim() ?? '';
  if (!value) return { raw: '0' };
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    diagnostics.push({
      code: 'invalid-number',
      message: `Valor numérico no válido: ${value}`,
      recordType: record.type,
      recordIndex: record.index,
      fatal: true,
    });
    return { raw: value };
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

  const decoded = decode(input).replaceAll(String.fromCharCode(0), '');
  const text = decoded.replace(new RegExp(`${String.fromCharCode(26)}+$`), '');
  const rawRecords = text.split(/\r?\n/).flatMap((line) => {
    const start = line.indexOf('~');
    return start < 0 ? [] : [line.slice(start)];
  });
  const records = rawRecords
    .map(splitRecord)
    .filter((record): record is RecordLine => record !== null);
  const headerRecord = records.find((record) => record.type === 'V');
  if (!headerRecord)
    return {
      document: null,
      diagnostics: [
        {
          code: 'missing-header',
          message: 'No se encontró el registro de cabecera ~V.',
          fatal: true,
        },
      ],
    };

  const headerFields = headerRecord.fields;
  const versionAndDate = headerFields[1]?.split('\\') ?? [];
  const titleAndPrice = headerFields[3]?.split('\\') ?? [];
  const type = Number(headerFields[6] ?? headerFields[7]);
  if (type === 3)
    return {
      document: null,
      diagnostics: [
        {
          code: 'unsupported-information-type',
          message: 'Los archivos de certificación BC3 no se importan en esta versión.',
          recordType: 'V',
          fatal: true,
        },
      ],
    };
  if (![1, 2, 4].includes(type))
    return {
      document: null,
      diagnostics: [
        {
          code: 'unsupported-information-type',
          message: 'El tipo de archivo indicado en ~V no está soportado.',
          recordType: 'V',
          fatal: true,
        },
      ],
    };
  const version = versionAndDate[0] || '';
  if (!/^\d+\/\d{4}$/.test(version))
    diagnostics.push({
      code: 'unsupported-version',
      message: `Versión FIEBDC no reconocida: ${version || '(vacía)'}.`,
      recordType: 'V',
      fatal: true,
    });

  const concepts: Record<string, FiebdcConcept> = {};
  const conceptByCode = new Map<string, FiebdcConcept>();
  const conceptIds = new Set<string>();
  for (const record of records.filter((item) => item.type === 'C')) {
    const code = record.fields[0]?.trim() ?? '';
    if (!code) {
      diagnostics.push({
        code: 'invalid-record',
        message: 'El registro ~C no incluye código.',
        recordType: 'C',
        recordIndex: record.index,
        fatal: true,
      });
      continue;
    }
    if (conceptByCode.has(code)) {
      diagnostics.push({
        code: 'duplicate-concept',
        message: `El código ${code} aparece en más de un registro ~C.`,
        recordType: 'C',
        recordIndex: record.index,
        fatal: true,
      });
      continue;
    }
    const prices = record.fields[3]
      ? [
          {
            label: titleAndPrice[1] || 'Venta',
            amount: parseDecimal(record.fields[3], diagnostics, record),
          },
        ]
      : [];
    const concept: FiebdcConcept = {
      id: safeId('concept', code, conceptIds),
      codes: [code],
      unit: record.fields[1] ?? '',
      summary: record.fields[2] ?? '',
      type: record.fields[6] === '0' ? 'work-unit' : 'resource',
      prices,
      dates: record.fields[4] ? [record.fields[4]] : [],
      texts: [],
      decomposition: [],
    };
    concepts[concept.id] = concept;
    conceptByCode.set(code, concept);
  }

  for (const record of records.filter((item) => item.type === 'D')) {
    const parent = record.fields[0] ?? '';
    const concept = conceptByCode.get(parent);
    if (!concept) {
      diagnostics.push({
        code: 'unknown-concept-reference',
        message: `~D refiere el concepto padre inexistente ${parent}.`,
        recordType: 'D',
        recordIndex: record.index,
        fatal: true,
      });
      continue;
    }
    const parts = record.fields.slice(1).join('|').split('\\').filter(Boolean);
    const lines: FiebdcDecompositionLine[] = [];
    for (let index = 0; index < parts.length; index += 3) {
      const code = parts[index];
      if (!code) continue;
      lines.push({
        code,
        factor: parseDecimal(parts[index + 1] || '1', diagnostics, record),
        yield: parseDecimal(parts[index + 2] || '1', diagnostics, record),
      });
    }
    concept.decomposition.push(...lines);
  }

  for (const record of records.filter((item) => item.type === 'T')) {
    const concept = conceptByCode.get(record.fields[0] ?? '');
    if (concept && record.fields[1]) concept.texts.push(record.fields[1]);
  }

  const typeValue = type as FiebdcInformationType;
  const usedNodeIds = new Set<string>();
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
        id: safeId('node', pathKey, usedNodeIds),
        conceptCode: code,
        children: [],
        measurements: [],
      };
      if (path.length) {
        const relation = `${path[path.length - 1]}\\${code}`;
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
    for (const concept of Object.values(concepts))
      if (!childCodes.has(concept.codes[0]!)) {
        const node = buildNode(concept.codes[0]!, new Set(), []);
        if (node) roots.push(node);
      }
  }
  for (const record of records.filter((item) => item.type === 'M')) {
    const relationCodes = (record.fields[0] ?? '').split('\\').filter(Boolean);
    const childCode = relationCodes.at(-1) ?? '';
    const parentCode = relationCodes.length > 1 ? relationCodes.at(-2) : undefined;
    if (!conceptByCode.has(childCode) || (parentCode && !conceptByCode.has(parentCode))) {
      const missingCode = !conceptByCode.has(childCode) ? childCode : parentCode!;
      diagnostics.push({
        code: 'unknown-concept-reference',
        message: `~M refiere el concepto inexistente ${missingCode}.`,
        recordType: 'M',
        recordIndex: record.index,
        fatal: true,
      });
      continue;
    }
    const node = parentCode
      ? nodesByRelation.get(`${parentCode}\\${childCode}`)?.[0]
      : roots.find((candidate) => candidate.conceptCode === childCode);
    if (!node) {
      diagnostics.push({
        code: 'unknown-concept-reference',
        message: `La relación de medición ${record.fields[0]} no existe en las descomposiciones ~D.`,
        recordType: 'M',
        recordIndex: record.index,
        fatal: true,
      });
      continue;
    }
    const details = (record.fields[3] ?? '').split('\\');
    const commentAndBim = details[1] ?? '';
    const bimIds = [...commentAndBim.matchAll(/#([^\s#]+)/g)].map((match) => match[1]!);
    const comment = commentAndBim.replace(/\s*#[^\s#]+/g, '').trim();
    node.measurements.push({
      position: record.fields[1],
      sourceType: details[0],
      total: record.fields[2] ? parseDecimal(record.fields[2], diagnostics, record) : undefined,
      comment: comment || undefined,
      bimIds: bimIds.length ? bimIds : undefined,
      units: details[2] ? parseDecimal(details[2], diagnostics, record) : undefined,
      length: details[3] ? parseDecimal(details[3], diagnostics, record) : undefined,
      breadth: details[4] ? parseDecimal(details[4], diagnostics, record) : undefined,
      height: details[5] ? parseDecimal(details[5], diagnostics, record) : undefined,
      label: record.fields[4] || undefined,
    });
  }

  const document: ConstructionDocument = {
    id: `bc3-${crypto.randomUUID()}`,
    schemaVersion: 1,
    kind: typeValue === 1 || typeValue === 4 ? 'catalog' : 'budget',
    header: {
      version,
      owner: headerFields[5] ?? headerFields[4] ?? '',
      program: headerFields[2] ?? '',
      title: titleAndPrice[0] ?? '',
      characterSet: headerFields[4] ?? 'ANSI',
      informationType: typeValue,
      certificationDate: versionAndDate[1],
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
        referencedCodes: [],
      })),
    business: {},
  };
  for (const issue of validateConstructionDocument(document))
    diagnostics.push({
      code:
        issue.code === 'unknown-concept-reference' ? 'unknown-concept-reference' : 'invalid-record',
      message: issue.message,
      fatal: true,
    });
  return {
    document: diagnostics.some((diagnostic) => diagnostic.fatal) ? null : document,
    diagnostics,
  };
}
