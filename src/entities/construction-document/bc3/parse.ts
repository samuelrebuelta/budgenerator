import { decodeBytes, type FiebdcCharset } from '@/shared/lib/charset';
import {
  CONSTRUCTION_SCHEMA_VERSION,
  bareCode,
  calculateConstructionTotals,
  createConcept,
  createRateResolver,
  defaultSettings,
  emptyBusiness,
  formatDecimal,
  isChapterCode,
  isDecimalText,
  isRootCode,
  measurementLinesTotal,
  parseDecimal,
  roundTo,
  validateConstructionContent,
  type ConstructionDocument,
  type ConstructionDocumentKind,
  type FiebdcConcept,
  type FiebdcDecompositionLine,
  type FiebdcExtensionRecord,
  type FiebdcInformationType,
  type FiebdcMeasurement,
  type FiebdcMeasurementLine,
  type FiebdcMeasurementLineType,
  type FiebdcNode,
  type FiebdcSettings,
} from '../model';
import type { Bc3Diagnostic, Bc3DiagnosticCode, Bc3Summary } from './types';

interface RecordLine {
  type: string;
  fields: string[];
  raw: string;
  index: number;
}

export interface Bc3ParseOptions {
  /** Target of the import. Budgets and templates require a work file (type 2). */
  target: ConstructionDocumentKind;
  today?: string;
}

export interface Bc3ParseResult {
  document: ConstructionDocument | null;
  diagnostics: Bc3Diagnostic[];
  summary: Bc3Summary;
}

/** Records with structural or economic meaning the app does not model: they block works. */
const BLOCKING_RECORDS = new Set(['B', 'N', 'R']);
const INTERPRETED_RECORDS = new Set(['V', 'K', 'C', 'D', 'Y', 'T', 'M']);
const MAX_INPUT_BYTES = 40_000_000;

function detectCharset(bytes: Uint8Array): { charset: FiebdcCharset | null; declared: string } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return { charset: 'UTF-8', declared: 'UTF-8' };
  const head = Array.from(bytes.subarray(0, 4096), (byte) => String.fromCharCode(byte)).join('');
  const match = /~V\|[^|~]*\|[^|~]*\|[^|~]*\|[^|~]*\|([^|~]*)\|/.exec(head);
  const declared = (match?.[1] ?? '').trim();
  const normalized = declared.toUpperCase().replace(/[\s_-]/g, '');
  if (!normalized || normalized === '850') return { charset: '850', declared: declared || '850' };
  if (normalized === '437') return { charset: '437', declared };
  if (normalized === 'ANSI' || normalized === '1252' || normalized === 'WINDOWS1252')
    return { charset: 'ANSI', declared };
  if (normalized === 'UTF8') return { charset: 'UTF-8', declared };
  return { charset: null, declared };
}

function emptySummary(): Bc3Summary {
  return {
    informationType: null,
    version: '',
    program: '',
    title: '',
    charset: '',
    records: 0,
    concepts: 0,
    chapters: 0,
    items: 0,
    measuredItems: 0,
    composedConcepts: 0,
    extensionTypes: [],
    declaredTotal: null,
    computedTotal: null,
  };
}

function splitSubfields(value: string | undefined): string[] {
  const parts = (value ?? '').split('\\');
  if (parts.length > 1 && parts.at(-1) === '') parts.pop();
  return parts;
}

/** Reads FIEBDC-3 bytes directly into the canonical document. Never touches storage. */
export function parseBc3(input: Uint8Array, options: Bc3ParseOptions): Bc3ParseResult {
  const diagnostics: Bc3Diagnostic[] = [];
  const summary = emptySummary();
  const report = (
    code: Bc3DiagnosticCode,
    message: string,
    severity: 'error' | 'warning' = 'error',
    record?: RecordLine,
  ) =>
    diagnostics.push({
      code,
      severity,
      message,
      ...(record ? { recordType: `~${record.type}`, recordIndex: record.index } : {}),
    });
  const fail = () => ({ document: null, diagnostics, summary });

  if (!input.length) {
    report('empty-file', 'El archivo está vacío.');
    return fail();
  }
  if (input.length > MAX_INPUT_BYTES) {
    report('too-large', 'El archivo supera los 40 MB que se pueden procesar en el navegador.');
    return fail();
  }
  const { charset, declared } = detectCharset(input);
  summary.charset = declared;
  if (!charset) {
    report(
      'unsupported-character-set',
      `El juego de caracteres «${declared}» no está soportado. Se admiten ANSI, 850 y 437.`,
    );
    return fail();
  }
  let text: string;
  try {
    text = decodeBytes(charset === 'UTF-8' && input[0] === 0xef ? input.subarray(3) : input, charset);
  } catch {
    report('unsupported-character-set', 'El archivo contiene bytes no válidos para su codificación.');
    return fail();
  }
  const eof = text.indexOf('\u001a');
  if (eof >= 0) text = text.slice(0, eof);
  text = text.replaceAll('\u0000', '');

  const pieces = text.split('~');
  if (pieces[0]!.trim())
    report('invalid-record', 'Hay contenido antes del primer registro; se ignora.', 'warning');
  const records: RecordLine[] = [];
  pieces.slice(1).forEach((piece, position) => {
    const index = position + 1;
    const type = piece[0] ?? '';
    const textRecord = type === 'T';
    let body = piece.slice(1);
    body = textRecord
      ? body.replace(/\r\n?/g, '\n').replace(/[\s]+$/, '')
      : body.replace(/[\r\n]/g, '').replace(/[ \t]+$/, '');
    const raw = `~${type}${body}`;
    const record: RecordLine = { type, fields: [], raw, index };
    if (!/^[A-Za-z]$/.test(type) || !body.startsWith('|')) {
      report('invalid-record', `El registro ${index} no tiene un formato FIEBDC válido.`, 'error', record);
      return;
    }
    const complete = body.endsWith('|');
    if (!complete) {
      const last = position === pieces.length - 2;
      report(
        last ? 'truncated-file' : 'invalid-record',
        last
          ? 'El archivo parece truncado: el último registro no termina con «|».'
          : `El registro ~${type} número ${index} no termina con «|».`,
        last ? 'error' : 'warning',
        record,
      );
    }
    const fields = body.slice(1).split('|');
    if (complete) fields.pop();
    record.fields = fields;
    records.push(record);
  });
  summary.records = records.length;

  const header = records[0];
  if (!header || header.type !== 'V') {
    report('missing-header', 'Falta el registro de cabecera ~V al inicio del archivo.');
    return fail();
  }
  if (records.slice(1).some((record) => record.type === 'V'))
    report('invalid-record', 'El archivo contiene más de una cabecera ~V.', 'error');

  const [owner = '', versionField = '', program = '', titleField = '', , comment = '', typeField = '', , , baseUrl = ''] =
    header.fields;
  const [version = '', versionDate = ''] = splitSubfields(versionField);
  const [title = '', ...priceLabels] = splitSubfields(titleField);
  summary.version = version;
  summary.program = program;
  summary.title = title;
  if (!/^FIEBDC-3\/\d{2,4}$/i.test(version.trim()))
    report(
      'unsupported-version',
      `Versión de formato no reconocida («${version || 'vacía'}»); se lee como FIEBDC-3.`,
      'warning',
      header,
    );

  const rawType = typeField.trim();
  let informationType: FiebdcInformationType;
  if (rawType === '3') {
    report(
      'unsupported-information-type',
      'El archivo es una certificación de obra; BudGenerator no importa certificaciones.',
      'error',
      header,
    );
    return fail();
  } else if (rawType === '4') {
    report(
      'unsupported-information-type',
      'El archivo es una actualización de base de datos; no se puede importar como catálogo ni presupuesto.',
      'error',
      header,
    );
    return fail();
  } else if (rawType === '1' || rawType === '2') informationType = Number(rawType) as 1 | 2;
  else if (!rawType) {
    informationType = records.some(
      (record) => record.type === 'C' && splitSubfields(record.fields[0]).some(isRootCode),
    )
      ? 2
      : 1;
    report(
      'unsupported-information-type',
      `La cabecera no indica el tipo de información; se interpreta como ${
        informationType === 2 ? 'presupuesto' : 'base de precios'
      }.`,
      'warning',
      header,
    );
  } else {
    report('unsupported-information-type', `Tipo de información FIEBDC desconocido: ${rawType}.`, 'error', header);
    return fail();
  }
  summary.informationType = informationType;
  const work = options.target !== 'catalog';
  if (work && informationType === 1) {
    report(
      'kind-mismatch',
      'El archivo es una base de precios. Impórtalo desde Catálogo para añadir sus partidas.',
    );
    return fail();
  }

  // ~K
  const settings: FiebdcSettings = defaultSettings();
  const kRecord = records.find((record) => record.type === 'K');
  if (kRecord) {
    settings.sourceRecord = kRecord.raw;
    let first = (kRecord.fields[0] ?? '').split('\\');
    if (first[0] === '' && first.length >= 10) first = first.slice(1);
    const third = (kRecord.fields[2] ?? '').split('\\');
    const int = (value: string | undefined, fallback: number) => {
      const parsed = Number((value ?? '').trim());
      return value?.trim() && Number.isInteger(parsed) && parsed >= 0 && parsed <= 8 ? parsed : fallback;
    };
    settings.decimals = {
      quantity: int(third[10], int(first[2], 2)),
      yield: int(third[0], int(first[3], 3)),
      price: int(third[12], int(first[6], 2)),
      amount: int(third[6], int(first[4], 2)),
    };
    const currency = (third[13] || first[8] || '').trim();
    if (currency) settings.currency = currency;
    const [ci = '', gg = '', bi = '', baja = '', iva = ''] = (kRecord.fields[1] ?? '').split('\\');
    const percentage = (value: string) => (isDecimalText(value) ? value.trim() : '0');
    settings.percentages = {
      indirect: percentage(ci),
      general: percentage(gg),
      profit: percentage(bi),
      discount: percentage(baja),
      vat: percentage(iva),
    };
    const applied = [
      ['costes indirectos', settings.percentages.indirect],
      ['gastos generales', settings.percentages.general],
      ['beneficio industrial', settings.percentages.profit],
      ['baja', settings.percentages.discount],
    ].filter(([, value]) => Number(value) !== 0);
    if (applied.length)
      report(
        'global-percentages',
        `El archivo define ${applied
          .map(([label, value]) => `${label} ${value} %`)
          .join(', ')}. Se conservan para exportar, pero el total de BudGenerator es la suma de partidas más IVA; usa el ajuste del presupuesto si quieres aplicarlos.`,
        'warning',
        kRecord,
      );
  }

  // ~C
  const concepts: Record<string, FiebdcConcept> = {};
  const byCode = new Map<string, FiebdcConcept>();
  let conceptSequence = 0;
  let multiplePrices = false;
  for (const record of records.filter((candidate) => candidate.type === 'C')) {
    const codes = splitSubfields(record.fields[0]).map((code) => code.trim()).filter(Boolean);
    if (!codes.length) {
      report('invalid-record', 'Un registro ~C no tiene código.', 'error', record);
      continue;
    }
    const duplicate = codes.find((code) => byCode.has(bareCode(code)));
    if (duplicate) {
      report('duplicate-concept', `El código ${duplicate} está definido más de una vez.`, 'error', record);
      continue;
    }
    const prices = splitSubfields(record.fields[3]).map((value) => value.trim());
    while (prices.length && prices.at(-1) === '') prices.pop();
    for (const price of prices)
      if (price && !isDecimalText(price))
        report('invalid-number', `Precio no numérico en ${codes[0]}: «${price}».`, 'error', record);
    if (prices.length > 1) multiplePrices = true;
    const concept = createConcept(`c${++conceptSequence}`, codes[0]!, {
      ...(codes.length > 1 ? { synonyms: codes.slice(1) } : {}),
      unit: (record.fields[1] ?? '').trim(),
      summary: record.fields[2] ?? '',
      prices,
      dates: splitSubfields(record.fields[4]).filter(Boolean),
      type: (record.fields[5] ?? '').trim() || '0',
    });
    concepts[concept.id] = concept;
    codes.forEach((code) => byCode.set(bareCode(code), concept));
  }
  if (multiplePrices)
    report(
      'multiple-prices',
      `El archivo tiene varios precios por concepto (${priceLabels.join(', ') || 'sin rótulos'}). BudGenerator usa el primero y conserva el resto para exportar.`,
      'warning',
    );
  const lookup = (code: string) => byCode.get(bareCode(code.trim()));

  // ~D / ~Y
  const decompositionCodes = new Map<string, { code: string; line: FiebdcDecompositionLine }[]>();
  for (const record of records.filter((candidate) => candidate.type === 'D' || candidate.type === 'Y')) {
    const parent = lookup(record.fields[0] ?? '');
    if (!parent) {
      report(
        'unknown-concept-reference',
        `~${record.type} referencia el concepto inexistente ${record.fields[0] ?? ''}.`,
        'error',
        record,
      );
      continue;
    }
    const quadruple = (record.fields[2] ?? '').trim() !== '';
    const parts = (quadruple ? record.fields[2]! : (record.fields[1] ?? '')).split('\\');
    const step = quadruple ? 4 : 3;
    if (parts.at(-1) === '') parts.pop();
    const lines: { code: string; line: FiebdcDecompositionLine }[] = [];
    for (let index = 0; index < parts.length; index += step) {
      const code = (parts[index] ?? '').trim();
      if (!code) continue;
      const factor = (parts[index + 1] ?? '').trim();
      const yieldValue = (parts[index + 2] ?? '').trim();
      const masks = quadruple
        ? (parts[index + 3] ?? '').split(';').map((mask) => mask.trim()).filter(Boolean)
        : [];
      if ((factor && !isDecimalText(factor)) || (yieldValue && !isDecimalText(yieldValue)))
        report('invalid-number', `Factor o rendimiento no numérico en la descomposición de ${parent.code}.`, 'error', record);
      const child = lookup(code);
      if (!child) {
        report('unknown-concept-reference', `La descomposición de ${parent.code} referencia ${code}, que no está definido.`, 'error', record);
        continue;
      }
      lines.push({
        code,
        line: { conceptId: child.id, factor, yield: yieldValue, ...(masks.length ? { percentageCodes: masks } : {}) },
      });
    }
    const previous = decompositionCodes.get(parent.id);
    if (record.type === 'Y') decompositionCodes.set(parent.id, [...(previous ?? []), ...lines]);
    else {
      if (previous)
        report('invalid-record', `La descomposición de ${parent.code} aparece varias veces; se usa la última.`, 'warning', record);
      decompositionCodes.set(parent.id, lines);
    }
  }

  // ~T
  for (const record of records.filter((candidate) => candidate.type === 'T')) {
    const concept = lookup(record.fields[0] ?? '');
    if (!concept) {
      report('unknown-concept-reference', `~T referencia el concepto inexistente ${record.fields[0] ?? ''}.`, 'warning', record);
      continue;
    }
    const value = record.fields.slice(1).join('|');
    if (value) concept.text = value;
  }

  // ~M (parsed before building the tree: measured parents identify chapters)
  interface PendingMeasurement {
    record: RecordLine;
    parentId: string | null;
    childId: string;
    measurement: FiebdcMeasurement;
  }
  const measurements: PendingMeasurement[] = [];
  const measuredParents = new Set<string>();
  for (const record of records.filter((candidate) => candidate.type === 'M')) {
    const relation = splitSubfields(record.fields[0]).map((code) => code.trim()).filter(Boolean);
    const child = lookup(relation.at(-1) ?? '');
    const parent = relation.length > 1 ? lookup(relation.at(-2)!) : undefined;
    if (!child || (relation.length > 1 && !parent)) {
      report('unknown-concept-reference', `La medición ${record.fields[0] ?? ''} referencia un concepto inexistente.`, 'error', record);
      continue;
    }
    const total = (record.fields[2] ?? '').trim();
    if (total && !isDecimalText(total))
      report('invalid-number', `Medición total no numérica en ${child.code}: «${total}».`, 'error', record);
    const values = (record.fields[3] ?? '').split('\\');
    if (values.at(-1) === '') values.pop();
    const lines: FiebdcMeasurementLine[] = [];
    for (let index = 0; index < values.length; index += 6) {
      const type = (values[index] ?? '').trim();
      const rawComment = values[index + 1] ?? '';
      const bimIds = [...rawComment.matchAll(/#(\S+)/g)].map((match) => match[1]!);
      const factors = [values[index + 2], values[index + 3], values[index + 4], values[index + 5]].map(
        (value) => (value ?? '').trim(),
      );
      if (factors.some((value) => value && !isDecimalText(value)))
        report('invalid-number', `Línea de medición no numérica en ${child.code}.`, 'error', record);
      if (!['', '1', '2', '3'].includes(type))
        report('invalid-record', `Tipo de línea de medición desconocido (${type}) en ${child.code}.`, 'error', record);
      const [units, length, width, height] = factors;
      lines.push({
        type: (['1', '2', '3'].includes(type) ? type : '') as FiebdcMeasurementLineType,
        comment: bimIds.length ? rawComment.replace(/\s*#\S+/g, '').trim() : rawComment,
        ...(bimIds.length ? { bimIds } : {}),
        ...(units ? { units } : {}),
        ...(length ? { length } : {}),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      });
    }
    const position = record.fields[1] ?? '';
    const label = record.fields[4] ?? '';
    measurements.push({
      record,
      parentId: parent?.id ?? null,
      childId: child.id,
      measurement: {
        ...(position ? { position } : {}),
        ...(total ? { total } : {}),
        ...(label ? { label } : {}),
        lines,
      },
    });
    if (parent) measuredParents.add(parent.id);
  }

  // Root
  const roots = Object.values(concepts).filter((concept) => isRootCode(concept.code));
  const referenced = new Set(
    [...decompositionCodes.values()].flatMap((lines) => lines.map((item) => item.line.conceptId)),
  );
  let root: FiebdcConcept | undefined;
  if (roots.length > 1) report('invalid-structure', 'El archivo tiene más de un concepto raíz (##).', 'error');
  else if (roots.length === 1) root = roots[0];
  else if (informationType === 2) {
    const candidates = Object.values(concepts).filter(
      (concept) => !referenced.has(concept.id) && decompositionCodes.has(concept.id),
    );
    if (candidates.length === 1) {
      root = candidates[0];
      report('invalid-structure', `La obra no marca su raíz con «##»; se usa ${root!.code}.`, 'warning');
    } else report('invalid-structure', 'No se puede identificar el concepto raíz de la obra (##).', 'error');
  }
  const kind: ConstructionDocumentKind = options.target === 'template' ? 'template' : informationType === 1 || options.target === 'catalog' ? 'catalog' : 'budget';
  if (!root) {
    root = createConcept(`c${++conceptSequence}`, kind === 'catalog' ? 'CATALOGO##' : 'PRESUPUESTO##', {
      summary: title,
    });
    concepts[root.id] = root;
  }

  const isChapter = (concept: FiebdcConcept, parent: FiebdcConcept | null) =>
    isChapterCode(concept.code) ||
    measuredParents.has(concept.id) ||
    (informationType === 1 && parent === root && decompositionCodes.has(concept.id));

  // Tree
  let nodeSequence = 0;
  const structural = new Set<string>([root.id]);
  const treeConcepts = new Set<string>();
  const build = (
    parent: FiebdcConcept,
    stack: Set<string>,
  ): FiebdcNode[] =>
    (decompositionCodes.get(parent.id) ?? []).flatMap(({ line }) => {
      const concept = concepts[line.conceptId]!;
      const node: FiebdcNode = {
        id: `n${++nodeSequence}`,
        conceptId: concept.id,
        factor: line.factor,
        quantity: line.yield,
        children: [],
      };
      treeConcepts.add(concept.id);
      if (isChapter(concept, parent)) {
        structural.add(concept.id);
        if (stack.has(concept.id)) {
          report('invalid-structure', `La estructura de capítulos de ${concept.code} es cíclica.`, 'error');
          return [];
        }
        if (work && (parseDecimal(line.factor, 1) ?? 0) * (parseDecimal(line.yield, 1) ?? 0) !== 1)
          report(
            'invalid-structure',
            `El capítulo ${concept.code} tiene un factor o rendimiento distinto de 1; BudGenerator no puede multiplicar capítulos.`,
          );
        node.children = build(concept, new Set(stack).add(concept.id));
        node.quantity = '1';
        node.factor = '';
      }
      return [node];
    });
  const tree = build(root, new Set([root.id]));

  // Item concepts keep their decomposition; chapters keep their structure in the tree.
  for (const [conceptId, lines] of decompositionCodes)
    if (!structural.has(conceptId)) concepts[conceptId]!.decomposition = lines.map((item) => item.line);
  for (const conceptId of structural)
    for (const concept of Object.values(concepts))
      if (concept.decomposition.some((line) => line.conceptId === conceptId))
        report('invalid-structure', `El capítulo ${concepts[conceptId]!.code} aparece dentro de la descomposición de ${concept.code}.`, 'error');

  // Orphans
  const used = new Set<string>([root.id, ...treeConcepts]);
  const markUsed = (id: string) => {
    for (const line of concepts[id]?.decomposition ?? [])
      if (!used.has(line.conceptId)) {
        used.add(line.conceptId);
        markUsed(line.conceptId);
      }
  };
  [...used].forEach(markUsed);
  const orphans = Object.values(concepts).filter((concept) => !used.has(concept.id));
  if (orphans.length) {
    if (kind === 'catalog') {
      for (const concept of orphans) {
        if (isChapterCode(concept.code)) continue;
        tree.push({ id: `n${++nodeSequence}`, conceptId: concept.id, factor: '', quantity: '1', children: [] });
        used.add(concept.id);
        markUsed(concept.id);
      }
    } else
      report(
        'unused-concepts',
        `${orphans.length} conceptos no forman parte de la obra y no se importan (${orphans
          .slice(0, 5)
          .map((concept) => concept.code)
          .join(', ')}${orphans.length > 5 ? '…' : ''}).`,
        'warning',
      );
  }

  // Measurements → nodes
  const nodesByConcept = new Map<string, { node: FiebdcNode; parent: FiebdcNode | null; position: number }[]>();
  const index = (nodes: FiebdcNode[], parent: FiebdcNode | null) =>
    nodes.forEach((node, position) => {
      nodesByConcept.set(node.conceptId, [...(nodesByConcept.get(node.conceptId) ?? []), { node, parent, position }]);
      index(node.children, node);
    });
  index(tree, null);
  for (const pending of measurements) {
    const candidates = (nodesByConcept.get(pending.childId) ?? []).filter((candidate) =>
      pending.parentId === null || pending.parentId === root.id
        ? candidate.parent === null || candidate.parent.conceptId === pending.parentId
        : candidate.parent?.conceptId === pending.parentId,
    );
    let target = candidates.length === 1 ? candidates[0] : undefined;
    if (candidates.length > 1) {
      const last = splitSubfields(pending.measurement.position).filter(Boolean).at(-1);
      const position = last ? Number(last) - 1 : NaN;
      target = candidates.find((candidate) => candidate.position === position);
    }
    const childCode = concepts[pending.childId]!.code;
    if (!target) {
      report(
        candidates.length ? 'invalid-structure' : 'unknown-concept-reference',
        candidates.length
          ? `La medición de ${childCode} es ambigua: el concepto aparece varias veces en el mismo capítulo.`
          : `La medición de ${childCode} no corresponde a ninguna partida de la estructura.`,
        work ? 'error' : 'warning',
        pending.record,
      );
      continue;
    }
    if (structural.has(pending.childId)) continue;
    const node = target.node;
    if (node.measurement)
      report('invalid-record', `La partida ${childCode} tiene varias mediciones; se usa la última.`, 'warning', pending.record);
    node.measurement = pending.measurement;
    const declared = parseDecimal(pending.measurement.total ?? '', null);
    const computed = pending.measurement.lines.length ? measurementLinesTotal(pending.measurement) : null;
    if (pending.measurement.lines.length && computed === null) {
      report('measurement-mismatch', `No se puede evaluar una línea de medición de ${childCode}.`, work ? 'error' : 'warning', pending.record);
      continue;
    }
    const decimals = settings.decimals.quantity;
    if (computed !== null && declared !== null && Math.abs(roundTo(computed, decimals) - declared) > 0.5 * 10 ** -decimals)
      report(
        'measurement-mismatch',
        `La medición de ${childCode} declara ${declared} pero sus líneas suman ${roundTo(computed, decimals)}.`,
        work ? 'error' : 'warning',
        pending.record,
      );
    const measured = computed !== null ? roundTo(computed, decimals) : declared;
    if (measured === null) continue;
    const yieldValue = (parseDecimal(node.factor, 1) ?? 1) * (parseDecimal(node.quantity, 1) ?? 1);
    if (Math.abs(yieldValue - measured) > 0.5 * 10 ** -decimals)
      report(
        'measurement-mismatch',
        `El rendimiento de ${childCode} en ~D (${yieldValue}) no coincide con su medición (${measured}); se usa la medición.`,
        'warning',
        pending.record,
      );
    node.factor = '';
    node.quantity = formatDecimal(measured, 6);
    if (!pending.measurement.lines.length) delete node.measurement;
  }

  // Extensions
  const extensions: FiebdcExtensionRecord[] = [];
  const extensionTypes = new Set<string>();
  for (const record of records) {
    if (INTERPRETED_RECORDS.has(record.type)) continue;
    if (BLOCKING_RECORDS.has(record.type) && work) {
      report('unsupported-record', `El registro ~${record.type} cambia la estructura o el importe y no está soportado.`, 'error', record);
      continue;
    }
    extensions.push({ type: `~${record.type}`, raw: record.raw });
    extensionTypes.add(`~${record.type}`);
  }
  summary.extensionTypes = [...extensionTypes];
  if (extensionTypes.size)
    report(
      'extension-records',
      `Se conservan sin interpretar ${extensions.length} registros (${[...extensionTypes].join(', ')}) para volver a exportarlos.`,
      'warning',
    );

  // IVA
  const vat = parseDecimal(settings.percentages.vat, 0) ?? 0;
  const ivaRate = vat > 0 && vat <= 100 ? roundTo(vat / 100, 6) : 0.1;
  if (work && !(vat > 0 && vat <= 100))
    report('default-vat', 'El archivo no indica IVA; se aplica el 10 % y puedes cambiarlo en el presupuesto.', 'warning');

  const today = options.today ?? new Date().toLocaleDateString('en-CA');
  const document: ConstructionDocument = {
    schemaVersion: CONSTRUCTION_SCHEMA_VERSION,
    kind,
    header: {
      owner,
      version: version.trim(),
      ...(versionDate ? { versionDate } : {}),
      program,
      title,
      priceLabels,
      charset: declared,
      comment,
      informationType: kind === 'catalog' ? 1 : 2,
      ...(baseUrl ? { baseUrl } : {}),
    },
    settings,
    rootConceptId: root.id,
    concepts: Object.fromEntries(Object.entries(concepts).filter(([id]) => used.has(id))),
    tree,
    extensions,
    business: emptyBusiness({
      name: kind === 'catalog' ? title || root.summary : root.summary || title,
      address: kind === 'budget' ? root.summary || title : '',
      date: today,
      ivaRate,
    }),
  };

  for (const issue of validateConstructionContent(document))
    report(
      issue.code === 'unknown-concept-reference' ? 'unknown-concept-reference' : 'invalid-structure',
      issue.message,
    );

  // Economic checks
  const { rate } = createRateResolver(document);
  let mismatched = 0;
  for (const concept of Object.values(document.concepts)) {
    if (!concept.decomposition.length || structural.has(concept.id)) continue;
    const declaredPrice = parseDecimal(concept.prices[0], null);
    if (declaredPrice === null) continue;
    if (Math.abs(rate(concept.id) - declaredPrice) > 0.005) {
      mismatched++;
      if (work)
        report(
          'price-mismatch',
          `El precio de ${concept.code} (${declaredPrice}) no coincide con su descomposición (${rate(concept.id)}).`,
        );
    }
  }
  if (mismatched && !work)
    report(
      'price-mismatch',
      `${mismatched} precios descompuestos no coinciden con la suma de su descomposición; BudGenerator usará el precio calculado.`,
      'warning',
    );

  const totals = calculateConstructionTotals({ ...document, business: { ...document.business, adjustment: undefined } });
  if (!totals.valid) for (const issue of totals.issues) report('invalid-number', issue.message);
  if (work) {
    summary.computedTotal = totals.raw;
    const declaredTotal = parseDecimal(root.prices[0], null);
    if (declaredTotal !== null && declaredTotal !== 0) {
      summary.declaredTotal = declaredTotal;
      if (Math.abs(declaredTotal - totals.raw) > 0.01)
        report(
          'total-mismatch',
          `El total declarado en el archivo (${declaredTotal}) no coincide con el calculado (${totals.raw}). No se importa para no cambiar el importe.`,
        );
    }
  }

  summary.concepts = Object.keys(document.concepts).length - 1;
  summary.chapters = [...structural].filter((id) => id !== root.id).length;
  let items = 0;
  let measuredItems = 0;
  const count = (nodes: FiebdcNode[]) =>
    nodes.forEach((node) => {
      if (structural.has(node.conceptId)) count(node.children);
      else {
        items++;
        if (node.measurement?.lines.length) measuredItems++;
      }
    });
  count(tree);
  summary.items = items;
  summary.measuredItems = measuredItems;
  summary.composedConcepts = Object.values(document.concepts).filter((concept) => concept.decomposition.length).length;

  const blocked = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  return { document: blocked ? null : document, diagnostics, summary };
}
