import type {
  ConstructionDocument,
  FiebdcConcept,
  FiebdcNode,
} from '@/entities/construction-document/model';

const windows1252SpecialCharacters = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function encodeAnsi(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    const byte =
      windows1252SpecialCharacters.get(codePoint) ?? (codePoint <= 0xff ? codePoint : undefined);
    if (byte === undefined)
      throw new Error(`No se puede exportar el carácter «${character}» con codificación ANSI.`);
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

function field(value: string): string {
  if (/[|~]/.test(value))
    throw new Error('El campo contiene separadores FIEBDC que todavía no se pueden escapar.');
  return value;
}

function serializeDecomposition(concept: FiebdcConcept): string {
  return concept.decomposition
    .map((line) =>
      [
        field(line.code),
        line.factor.raw,
        line.yield.raw,
        ...(line.percentageCodes?.length ? [line.percentageCodes.join(';')] : []),
      ].join('\\'),
    )
    .join('\\');
}

function serializeNode(node: FiebdcNode, parentCode: string | undefined, lines: string[]) {
  for (const [index, measurement] of node.measurements.entries()) {
    const comment = [
      measurement.comment,
      ...(measurement.bimIds ?? []).map((id) => `#${field(id)}`),
    ]
      .filter(Boolean)
      .join(' ');
    const details = [
      measurement.sourceType ?? '1',
      comment,
      measurement.units?.raw ?? '',
      measurement.length?.raw ?? '',
      measurement.breadth?.raw ?? '',
      measurement.height?.raw ?? '',
    ].join('\\');
    lines.push(
      `~M|${parentCode ? `${field(parentCode)}\\` : ''}${field(node.conceptCode)}|${measurement.position ?? index + 1}|${measurement.total?.raw ?? ''}|${details}|${field(measurement.label ?? '')}|`,
    );
  }
  node.children.forEach((child) => serializeNode(child, node.conceptCode, lines));
}

/** Serializes the canonical document directly; it never creates a legacy budget or catalog. */
export function serializeBc3(document: ConstructionDocument): Uint8Array {
  const header = document.header;
  if (header.informationType !== (document.kind === 'catalog' ? 1 : 2))
    throw new Error('El tipo de documento no coincide con su cabecera FIEBDC.');
  if (header.characterSet.toUpperCase() !== 'ANSI')
    throw new Error(`La exportación solo admite ANSI; la cabecera indica ${header.characterSet}.`);

  const priceLabels = header.priceLabels?.length
    ? header.priceLabels
    : [
        ...new Set(
          Object.values(document.concepts).flatMap((concept) =>
            concept.prices.map((price) => price.label),
          ),
        ),
      ];
  const lines = [
    `~V|${field(header.owner)}|${field(header.version)}${header.sourceDate ? `\\${field(header.sourceDate)}` : ''}|${field(header.program)}|${[header.title, ...priceLabels].map(field).join('\\')}|ANSI|${field(header.comment ?? '')}|${header.informationType}|${header.certificationNumber ?? ''}|${header.certificationDate ?? ''}|${header.baseUrl ?? ''}|`,
  ];
  const concepts = Object.values(document.concepts);
  for (const concept of concepts) {
    const prices = priceLabels.map(
      (label) =>
        concept.prices.find((price) => price.label === label)?.amount.raw ??
        concept.prices.at(-1)?.amount.raw ??
        '',
    );
    lines.push(
      `~C|${concept.codes.map(field).join('\\')}|${field(concept.unit)}|${field(concept.summary)}|${prices.join('\\')}|${concept.dates.join('\\')}|${field(concept.type)}|`,
    );
  }
  for (const concept of concepts) {
    if (concept.decomposition.length)
      lines.push(
        `~D|${field(concept.codes[0] ?? concept.id)}||${serializeDecomposition(concept)}|`,
      );
  }
  for (const concept of concepts) {
    for (const text of concept.texts)
      lines.push(`~T|${field(concept.codes[0] ?? concept.id)}|${text}|`);
  }
  for (const node of document.roots) serializeNode(node, undefined, lines);
  for (const record of [...document.opaqueRecords].sort((a, b) => a.order - b.order)) {
    if (!record.raw.startsWith('~') || /[\r\n]/.test(record.raw.slice(0, 2)))
      throw new Error('El documento contiene un registro extendido no válido.');
    lines.push(record.raw);
  }
  return encodeAnsi(`${lines.join('\r\n')}\r\n${String.fromCharCode(26)}`);
}
