import { validateConstructionContent, walkNodes } from './invariants.js';
import {
  CONSTRUCTION_SCHEMA_VERSION,
  type ConstructionContent,
  type ConstructionDocument,
  type FiebdcConcept,
} from './types.js';

/** UTF-8 bytes per stored chunk; leaves room under Firestore's 1 MiB document limit. */
export const CONTENT_CHUNK_BYTES = 900_000;
/** A save is a single transaction (10 MiB request limit), so content is capped at 8 chunks. */
export const MAX_CONTENT_CHUNKS = 8;
export const MAX_CONTENT_BYTES = CONTENT_CHUNK_BYTES * MAX_CONTENT_CHUNKS;

export class ContentTooLargeError extends Error {
  constructor(bytes: number) {
    super(
      `El documento ocupa ${(bytes / 1_000_000).toFixed(1)} MB y supera el máximo de ${(
        MAX_CONTENT_BYTES / 1_000_000
      ).toFixed(1)} MB que se puede guardar.`,
    );
    this.name = 'ContentTooLargeError';
  }
}

export function contentOf(document: ConstructionDocument): ConstructionContent {
  const { schemaVersion, kind, header, settings, rootConceptId, concepts, tree, extensions } =
    document;
  return { schemaVersion, kind, header, settings, rootConceptId, concepts, tree, extensions };
}

function utf8Length(codePoint: number) {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/** Splits text into pieces whose UTF-8 size stays below `maxBytes`, never inside a surrogate pair. */
export function splitUtf8(text: string, maxBytes = CONTENT_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let start = 0;
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!;
    const width = codePoint > 0xffff ? 2 : 1;
    const size = utf8Length(codePoint);
    if (bytes + size > maxBytes) {
      chunks.push(text.slice(start, index));
      start = index;
      bytes = 0;
    }
    bytes += size;
    index += width;
  }
  chunks.push(text.slice(start));
  return chunks;
}

export function utf8ByteLength(text: string) {
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!;
    bytes += utf8Length(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes;
}

/** Serializes the FIEBDC content into ordered chunk strings. */
export function encodeContent(content: ConstructionContent): string[] {
  const issues = validateConstructionContent(content);
  if (issues.length) throw new Error(issues[0]!.message);
  const text = JSON.stringify(content);
  const bytes = utf8ByteLength(text);
  if (bytes > MAX_CONTENT_BYTES) throw new ContentTooLargeError(bytes);
  return splitUtf8(text);
}

/** Rebuilds and validates content from its chunks. */
export function decodeContent(chunks: readonly string[]): ConstructionContent {
  const parsed = JSON.parse(chunks.join('')) as ConstructionContent;
  if (parsed?.schemaVersion !== CONSTRUCTION_SCHEMA_VERSION)
    throw new Error('El documento guardado usa una versión de esquema no compatible.');
  const issues = validateConstructionContent(parsed);
  if (issues.length) throw new Error(`El documento guardado no es válido: ${issues[0]!.message}`);
  return parsed;
}

/**
 * Removes private BudGenerator extensions (costs, catalog links) and the price breakdown
 * before content leaves the account: public share links and the public viewer.
 * `prices` are replaced by the adjusted unit price the client must see.
 */
export function toPublicContent(
  content: ConstructionContent,
  publicPrice: (conceptId: string) => number | null,
): ConstructionContent {
  const used = new Set<string>([content.rootConceptId]);
  walkNodes(content.tree, (node) => used.add(node.conceptId));
  const concepts: Record<string, FiebdcConcept> = {};
  for (const id of used) {
    const concept = content.concepts[id];
    if (!concept) continue;
    const price = publicPrice(id);
    concepts[id] = {
      id: concept.id,
      code: concept.code,
      unit: concept.unit,
      summary: concept.summary,
      prices: price === null ? [] : [String(price)],
      dates: [],
      type: concept.type,
      decomposition: [],
      ...(concept.text ? { text: concept.text } : {}),
    };
  }
  return {
    schemaVersion: CONSTRUCTION_SCHEMA_VERSION,
    kind: content.kind,
    header: { ...content.header, owner: '', comment: '' },
    settings: { ...content.settings, sourceRecord: undefined },
    rootConceptId: content.rootConceptId,
    concepts,
    tree: structuredClone(content.tree),
    extensions: [],
  };
}
