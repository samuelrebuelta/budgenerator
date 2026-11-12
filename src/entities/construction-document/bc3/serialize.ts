import { encodeWindows1252 } from '@/shared/lib/charset';
import {
  APP_FIEBDC_VERSION,
  APP_PROGRAM,
  calculateConstructionTotals,
  createRateResolver,
  formatDecimal,
  formatFixed,
  isChapterNode,
  isRootCode,
  nodeQuantity,
  walkNodes,
  type ConstructionDocument,
  type FiebdcConcept,
  type FiebdcNode,
} from '../model';

export interface Bc3ExportResult {
  bytes: Uint8Array;
  /** Information that could not be written as-is; shown to the user before downloading. */
  warnings: string[];
}

/**
 * FIEBDC has no escape sequences: `~`, `|` and `\` are reserved. Text fields replace them
 * with visually similar characters and the export reports it.
 */
function cleanField(value: string, replaced: Set<string>, allowNewlines = false): string {
  let text = value.replace(/[~|\\]/g, (character) => {
    replaced.add(character);
    return character === '~' ? '-' : '/';
  });
  text = allowNewlines ? text.replace(/\r?\n/g, '\r\n') : text.replace(/[\r\n]+/g, ' ');
  return text;
}

function ddmmyyyy(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}`;
}

/** Writes the canonical document as FIEBDC-3 (ANSI, CRLF, EOF 0x1A). */
export function serializeBc3(
  document: ConstructionDocument,
  options: { now?: Date } = {},
): Bc3ExportResult {
  const warnings: string[] = [];
  const replaced = new Set<string>();
  const f = (value: string | undefined) => cleanField(value ?? '', replaced);
  const totals = calculateConstructionTotals(document);
  if (!totals.valid) throw new Error(totals.issues[0]?.message ?? 'El documento no es válido.');
  const { rate } = createRateResolver(document);
  const work = document.kind !== 'catalog';
  const header = document.header;
  const root = document.concepts[document.rootConceptId]!;
  const rootCode = isRootCode(root.code) ? root.code : `${root.code}##`;
  const codeOf = (concept: FiebdcConcept) => (concept.id === root.id ? rootCode : concept.code);
  const lines: string[] = [];

  const version = /^FIEBDC-3\/\d{2,4}$/i.test(header.version) ? header.version : APP_FIEBDC_VERSION;
  const title = work ? document.business.address || header.title : document.business.name || header.title;
  lines.push(
    `~V|${f(header.owner)}|${version}\\${ddmmyyyy(options.now ?? new Date())}|${APP_PROGRAM}|${[
      title,
      ...header.priceLabels,
    ]
      .map(f)
      .join('\\')}|ANSI|${f(header.comment)}|${work ? 2 : 1}|||${f(header.baseUrl)}|`,
  );

  const { decimals, percentages, currency } = document.settings;
  const vat = work ? formatDecimal(document.business.ivaRate * 100, 4) : percentages.vat;
  const percentageField = `${percentages.indirect}\\${percentages.general}\\${percentages.profit}\\${percentages.discount}\\${vat}\\`;
  const source = document.settings.sourceRecord?.split('|');
  if (source && source.length >= 3) {
    source[2] = percentageField;
    lines.push(source.join('|').replace(/\|?$/, '|'));
  } else
    lines.push(
      `~K|2\\2\\${decimals.quantity}\\${decimals.yield}\\${decimals.amount}\\2\\${decimals.price}\\2\\${f(currency)}\\|${percentageField}|`,
    );

  // Prices: root and chapters carry their computed amounts; composed concepts their rate.
  const structuralPrice = new Map<string, number>();
  structuralPrice.set(root.id, totals.raw);
  walkNodes(document.tree, (node) => {
    const concept = document.concepts[node.conceptId];
    if (isChapterNode(node, concept))
      structuralPrice.set(node.conceptId, totals.nodes.get(node.id)?.rawAmount ?? 0);
  });
  for (const concept of Object.values(document.concepts)) {
    const prices = [...concept.prices];
    if (structuralPrice.has(concept.id)) prices[0] = formatFixed(structuralPrice.get(concept.id)!, decimals.amount);
    else if (concept.decomposition.length) prices[0] = formatFixed(rate(concept.id), decimals.price);
    const codes = [codeOf(concept), ...(concept.synonyms ?? [])].map(f).join('\\');
    lines.push(
      `~C|${codes}|${f(concept.unit)}|${f(concept.id === root.id ? title || concept.summary : concept.summary)}|${prices.map(f).join('\\')}${prices.length ? '\\' : ''}|${concept.dates.map(f).join('\\')}${concept.dates.length ? '\\' : ''}|${f(concept.type)}|`,
    );
  }

  const decompositionRecord = (
    parent: FiebdcConcept,
    entries: { code: string; factor: string; yield: string; masks?: string[] }[],
  ) => {
    if (!entries.length) return;
    const quadruple = entries.some((entry) => entry.masks?.length);
    const body = entries
      .map((entry) =>
        [f(entry.code), entry.factor, entry.yield, ...(quadruple ? [(entry.masks ?? []).map(f).join(';')] : [])].join('\\'),
      )
      .join('\\');
    lines.push(quadruple ? `~D|${f(codeOf(parent))}||${body}\\|` : `~D|${f(codeOf(parent))}|${body}\\|`);
  };
  const structureLines = (nodes: FiebdcNode[]) =>
    nodes.map((node) => {
      const concept = document.concepts[node.conceptId]!;
      const chapter = isChapterNode(node, concept);
      if (chapter) return { code: codeOf(concept), factor: '1', yield: '1' };
      if (node.measurement?.lines.length)
        return {
          code: codeOf(concept),
          factor: '1',
          yield: formatDecimal(nodeQuantity(node, decimals.quantity) ?? 0, 6),
        };
      return { code: codeOf(concept), factor: node.factor || '1', yield: node.quantity || '0' };
    });
  decompositionRecord(root, structureLines(document.tree));
  const writtenChapters = new Map<string, string>();
  walkNodes(document.tree, (node) => {
    const concept = document.concepts[node.conceptId]!;
    if (!isChapterNode(node, concept)) return;
    const entries = structureLines(node.children);
    const signature = JSON.stringify(entries);
    const previous = writtenChapters.get(concept.id);
    if (previous !== undefined) {
      if (previous !== signature)
        throw new Error(`El capítulo ${concept.code} aparece dos veces con contenido distinto.`);
      return;
    }
    writtenChapters.set(concept.id, signature);
    decompositionRecord(concept, entries);
  });
  for (const concept of Object.values(document.concepts))
    if (concept.decomposition.length && !structuralPrice.has(concept.id))
      decompositionRecord(
        concept,
        concept.decomposition.map((line) => ({
          code: codeOf(document.concepts[line.conceptId]!),
          factor: line.factor,
          yield: line.yield,
          ...(line.percentageCodes ? { masks: line.percentageCodes } : {}),
        })),
      );

  for (const concept of Object.values(document.concepts))
    if (concept.text) lines.push(`~T|${f(codeOf(concept))}|${cleanField(concept.text, replaced, true)}|`);

  const measurementRecords = (nodes: FiebdcNode[], parent: FiebdcConcept, path: number[]) =>
    nodes.forEach((node, index) => {
      const concept = document.concepts[node.conceptId]!;
      const position = [...path, index + 1];
      if (isChapterNode(node, concept)) {
        measurementRecords(node.children, concept, position);
        return;
      }
      const measurement = node.measurement;
      if (!measurement?.lines.length) return;
      const values = measurement.lines
        .map((line) =>
          [
            line.type,
            f([line.comment, ...(line.bimIds ?? []).map((id) => `#${id}`)].filter(Boolean).join(' ')),
            line.units ?? '',
            line.length ?? '',
            line.width ?? '',
            line.height ?? '',
          ].join('\\'),
        )
        .join('\\');
      const total = formatDecimal(nodeQuantity(node, decimals.quantity) ?? 0, 6);
      lines.push(
        `~M|${f(codeOf(parent))}\\${f(codeOf(concept))}|${position.join('\\')}\\|${total}|${values}\\|${f(measurement.label)}|`,
      );
    });
  measurementRecords(document.tree, root, []);

  for (const record of document.extensions) lines.push(record.raw.replace(/\r?\n/g, '\r\n').replace(/\|?$/, '|'));

  if (replaced.size)
    warnings.push(
      `Los caracteres reservados de FIEBDC (${[...replaced].join(' ')}) se han sustituido por «/» o «-».`,
    );
  if (work) {
    const excluded = [
      document.business.clientName && 'cliente',
      document.business.budgetNumber && 'número de presupuesto',
      document.business.adjustment && document.business.adjustment.multiplier !== 1 && 'ajuste de precios',
    ].filter(Boolean);
    if (excluded.length)
      warnings.push(
        `FIEBDC no tiene campos equivalentes para: ${excluded.join(', ')}. No se incluyen en el archivo; los importes se exportan sin ajuste.`,
      );
  }
  if (Object.values(document.concepts).some((concept) => concept.cost))
    warnings.push('Los costes internos son privados y no se exportan.');

  const encoded = encodeWindows1252(`${lines.join('\r\n')}\r\n\u001a`);
  if (encoded.replaced.length)
    warnings.push(
      `Algunos caracteres no existen en ANSI y se han sustituido por «?»: ${encoded.replaced.slice(0, 10).join(' ')}`,
    );
  return { bytes: encoded.bytes, warnings };
}

/** File name safe for every platform. */
export function bc3FileName(name: string) {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^A-Za-z0-9 _.-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'documento';
  return `${base}.bc3`;
}
