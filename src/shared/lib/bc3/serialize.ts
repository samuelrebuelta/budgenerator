import type { ConstructionDocument, FiebdcConcept } from '@/entities/construction-document/model';

function cleanField(value: string): string {
  return value.replace(/\|/g, ' ');
}

function decompose(concept: FiebdcConcept): string {
  return concept.decomposition
    .map((line) => `${cleanField(line.code)}\\${line.factor.raw}\\${line.yield.raw}`)
    .join('\\');
}

function serializeNode(
  node: ConstructionDocument['roots'][number],
  parentCode: string | undefined,
  lines: string[],
) {
  for (const [index, measurement] of node.measurements.entries()) {
    const comment = [measurement.comment, ...(measurement.bimIds ?? []).map((id) => `#${id}`)]
      .filter(Boolean)
      .join(' ');
    const details = [
      measurement.sourceType ?? '1',
      comment,
      measurement.units?.raw,
      measurement.length?.raw,
      measurement.breadth?.raw,
      measurement.height?.raw,
    ].join('\\');
    lines.push(
      `~M|${parentCode ? `${cleanField(parentCode)}\\` : ''}${cleanField(node.conceptCode)}|${measurement.position ?? index + 1}|${measurement.total?.raw ?? ''}|${details}|${cleanField(measurement.label ?? '')}|`,
    );
  }
  node.children.forEach((child) => serializeNode(child, node.conceptCode, lines));
}

/** Serializes the canonical document directly; no legacy budget/catalog adapter is involved. */
export function serializeBc3(document: ConstructionDocument): Uint8Array {
  const header = document.header;
  const lines = [
    `~V|${cleanField(header.owner)}|${cleanField(header.version)}${header.certificationDate ? `\\${cleanField(header.certificationDate)}` : ''}|${cleanField(header.program)}|${cleanField(header.title)}|${cleanField(header.characterSet)}|${cleanField(header.owner)}|${header.informationType}|`,
  ];
  const concepts = Object.values(document.concepts);
  for (const concept of concepts) {
    const price = concept.prices[0];
    lines.push(
      `~C|${cleanField(concept.codes[0] ?? concept.id)}|${cleanField(concept.unit)}|${cleanField(concept.summary)}|${price?.amount.raw ?? ''}|${concept.dates[0] ?? ''}|${concept.type === 'work-unit' ? '0' : '1'}|`,
    );
  }
  for (const concept of concepts)
    if (concept.decomposition.length)
      lines.push(`~D|${cleanField(concept.codes[0] ?? concept.id)}|${decompose(concept)}|`);
  for (const concept of concepts)
    for (const text of concept.texts)
      lines.push(`~T|${cleanField(concept.codes[0] ?? concept.id)}|${text}|`);
  for (const node of document.roots) serializeNode(node, undefined, lines);
  for (const record of [...document.opaqueRecords].sort((a, b) => a.order - b.order))
    lines.push(record.raw);
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n\u001a`);
}
