import { normalizeUnit } from '../../../shared/types/units.js';
import { formatDecimal, parseDecimal } from './decimal.js';
import { createAllocator, createConcept, type Allocator } from './factory.js';
import { bareCode, isChapterNode, walkNodes } from './invariants.js';
import { measurementLinesTotal } from './measurement.js';
import { createRateResolver } from './math.js';
import { ROOT_CHAPTER_ID, ROOT_CHAPTER_NAME } from './projection.js';
import type {
  ConstructionBusiness,
  ConstructionContent,
  ConstructionDocument,
  FiebdcConcept,
  FiebdcMeasurementLine,
  FiebdcNode,
} from './types.js';

/**
 * Edit operations over the canonical document. Every function is pure: it returns a new
 * document and never mutates its input, so stores can keep previous values for undo/conflicts.
 */

export interface ItemInput {
  description?: string;
  unit?: string;
  price?: number;
  cost?: number;
  quantity?: number;
  text?: string;
}

export interface ChapterInput {
  name: string;
  catalogChapterId?: string;
  items: (ItemInput & { catalogConceptId?: string })[];
}

function assertAmount(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1e12)
    throw new Error(`${label} debe ser un número positivo.`);
}

const amountText = (value: number, label: string) => {
  assertAmount(value, label);
  return formatDecimal(value, 6);
};

export function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapNodes(
  nodes: readonly FiebdcNode[],
  update: (node: FiebdcNode) => FiebdcNode | null,
): FiebdcNode[] {
  const result: FiebdcNode[] = [];
  for (const node of nodes) {
    const children = mapNodes(node.children, update);
    const withChildren =
      children.length === node.children.length &&
      children.every((child, i) => child === node.children[i])
        ? node
        : { ...node, children };
    const next = update(withChildren);
    if (next) result.push(next);
  }
  return result;
}

function locate(content: ConstructionContent, nodeId: string): FiebdcNode {
  let found: FiebdcNode | null = null;
  walkNodes(content.tree, (node) => {
    if (node.id === nodeId) found = node;
  });
  if (!found) throw new Error('No se encuentra la partida o el capítulo.');
  return found;
}

/** Drops concepts that are no longer reachable from the structure (root is always kept). */
export function collectGarbage<T extends ConstructionContent>(content: T): T {
  const reachable = new Set<string>([content.rootConceptId]);
  const visit = (id: string) => {
    if (reachable.has(id) && id !== content.rootConceptId) return;
    reachable.add(id);
    content.concepts[id]?.decomposition.forEach((line) => visit(line.conceptId));
  };
  walkNodes(content.tree, (node) => visit(node.conceptId));
  if (Object.keys(content.concepts).every((id) => reachable.has(id))) return content;
  const concepts = Object.fromEntries(
    Object.entries(content.concepts).filter(([id]) => reachable.has(id)),
  );
  return { ...content, concepts };
}

function withConcept<T extends ConstructionContent>(content: T, concept: FiebdcConcept): T {
  return { ...content, concepts: { ...content.concepts, [concept.id]: concept } };
}

function insertNode<T extends ConstructionContent>(
  content: T,
  parentId: string,
  node: FiebdcNode,
): T {
  if (parentId === ROOT_CHAPTER_ID) return { ...content, tree: [...content.tree, node] };
  locate(content, parentId);
  return {
    ...content,
    tree: mapNodes(content.tree, (current) =>
      current.id === parentId ? { ...current, children: [...current.children, node] } : current,
    ),
  };
}

function replaceNode<T extends ConstructionContent>(
  content: T,
  nodeId: string,
  update: (node: FiebdcNode) => FiebdcNode | null,
): T {
  locate(content, nodeId);
  return {
    ...content,
    tree: mapNodes(content.tree, (node) => (node.id === nodeId ? update(node) : node)),
  };
}

export function updateBusiness(
  document: ConstructionDocument,
  patch: Partial<ConstructionBusiness>,
): ConstructionDocument {
  const business = { ...document.business, ...patch };
  if ('adjustment' in patch && !patch.adjustment) delete business.adjustment;
  if (!Number.isFinite(business.ivaRate) || business.ivaRate < 0 || business.ivaRate > 1)
    throw new Error('Revisa el IVA y el porcentaje de ajuste.');
  const multiplier = business.adjustment?.multiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 11)
    throw new Error('Revisa el IVA y el porcentaje de ajuste.');
  const root = document.concepts[document.rootConceptId];
  const title = document.kind === 'budget' ? business.address : business.name;
  return {
    ...document,
    header: { ...document.header, title },
    concepts: root
      ? { ...document.concepts, [root.id]: { ...root, summary: title } }
      : document.concepts,
    business,
  };
}

function newItemConcept(alloc: Allocator, input: ItemInput, code?: string): FiebdcConcept {
  const price = input.price ?? 0;
  const cost = input.cost ?? 0;
  return createConcept(alloc.conceptId(), code ?? alloc.itemCode(), {
    summary: input.description ?? '',
    unit: normalizeUnit(input.unit ?? 'm2'),
    prices: [amountText(price, 'El precio')],
    ...(cost ? { cost: amountText(cost, 'El coste') } : {}),
    ...(input.text ? { text: input.text } : {}),
  });
}

export function addChapter<T extends ConstructionContent>(
  content: T,
  name: string,
  options: { catalogChapterId?: string; parentId?: string } = {},
): { document: T; chapterId: string } {
  const alloc = createAllocator(content);
  const concept = createConcept(alloc.conceptId(), alloc.chapterCode(), {
    summary: name.trim(),
    ...(options.catalogChapterId ? { source: { catalogChapterId: options.catalogChapterId } } : {}),
  });
  const node: FiebdcNode = {
    id: alloc.nodeId(),
    conceptId: concept.id,
    factor: '',
    quantity: '1',
    children: [],
  };
  return {
    document: insertNode(withConcept(content, concept), options.parentId ?? ROOT_CHAPTER_ID, node),
    chapterId: node.id,
  };
}

export function renameChapter<T extends ConstructionContent>(
  content: T,
  chapterId: string,
  name: string,
): T {
  const node = locate(content, chapterId);
  const concept = content.concepts[node.conceptId];
  if (!concept) throw new Error('No se encuentra el capítulo.');
  return withConcept(content, { ...concept, summary: name.trim() });
}

export function removeNode<T extends ConstructionContent>(content: T, nodeId: string): T {
  return collectGarbage(replaceNode(content, nodeId, () => null));
}

export function addItem<T extends ConstructionContent>(
  content: T,
  chapterId: string,
  input: ItemInput = {},
): { document: T; nodeId: string } {
  const alloc = createAllocator(content);
  const concept = newItemConcept(alloc, input);
  const node: FiebdcNode = {
    id: alloc.nodeId(),
    conceptId: concept.id,
    factor: '',
    quantity: amountText(input.quantity ?? 0, 'La cantidad'),
    children: [],
  };
  return { document: insertNode(withConcept(content, concept), chapterId, node), nodeId: node.id };
}

function isSharedConcept(content: ConstructionContent, conceptId: string, nodeId: string) {
  let shared = false;
  walkNodes(content.tree, (node) => {
    if (node.conceptId === conceptId && node.id !== nodeId) shared = true;
  });
  for (const concept of Object.values(content.concepts))
    if (concept.decomposition.some((line) => line.conceptId === conceptId)) shared = true;
  return shared;
}

/**
 * Updates an item. Concept fields (description, unit, price, cost) edit the concept; when
 * another occurrence uses it, the item gets its own copy so siblings keep their values.
 */
export function updateItem<T extends ConstructionContent>(
  content: T,
  nodeId: string,
  patch: ItemInput,
): T {
  const node = locate(content, nodeId);
  let concept = content.concepts[node.conceptId];
  if (!concept) throw new Error('No se encuentra la partida.');
  let next: T = content;
  const conceptPatch: Partial<FiebdcConcept> = {};
  if (patch.description !== undefined) conceptPatch.summary = patch.description;
  if (patch.unit !== undefined) conceptPatch.unit = normalizeUnit(patch.unit);
  if (patch.text !== undefined) conceptPatch.text = patch.text;
  if (patch.price !== undefined) {
    if (concept.decomposition.length)
      throw new Error('El precio de esta partida se calcula con su descomposición.');
    conceptPatch.prices = [amountText(patch.price, 'El precio'), ...concept.prices.slice(1)];
  }
  if (patch.cost !== undefined) conceptPatch.cost = amountText(patch.cost, 'El coste');
  if (Object.keys(conceptPatch).length) {
    if (isSharedConcept(content, concept.id, nodeId)) {
      const alloc = createAllocator(content);
      concept = { ...concept, id: alloc.conceptId(), code: alloc.itemCode() };
      next = replaceNode(next, nodeId, (current) => ({ ...current, conceptId: concept!.id }));
    }
    next = withConcept(next, { ...concept, ...conceptPatch });
  }
  if (patch.quantity !== undefined) {
    if (node.measurement?.lines.length)
      throw new Error('La cantidad de esta partida se calcula con sus mediciones.');
    const quantity = amountText(patch.quantity, 'La cantidad');
    next = replaceNode(next, nodeId, (current) => ({ ...current, quantity }));
  }
  return collectGarbage(next);
}

/** Replaces the measurement lines of an occurrence and keeps the ~D yield in sync. */
export function setMeasurementLines<T extends ConstructionContent>(
  content: T,
  nodeId: string,
  lines: FiebdcMeasurementLine[],
): T {
  return replaceNode(content, nodeId, (node) => {
    if (!lines.length) {
      const rest = { ...node };
      delete rest.measurement;
      return rest;
    }
    const measurement = { ...node.measurement, lines };
    delete measurement.total;
    const total = measurementLinesTotal(measurement);
    if (total === null) throw new Error('Revisa los valores de las mediciones.');
    if (total < 0) throw new Error('La medición total no puede ser negativa.');
    return { ...node, factor: '', quantity: formatDecimal(total, 6), measurement };
  });
}

/** Turns a composed price into a direct price with the same value (explicit user action). */
export function flattenItemPrice<T extends ConstructionContent>(content: T, nodeId: string): T {
  const node = locate(content, nodeId);
  const concept = content.concepts[node.conceptId];
  if (!concept?.decomposition.length) return content;
  const price = createRateResolver(content).rate(concept.id);
  let next: T = content;
  let target = concept;
  if (isSharedConcept(content, concept.id, nodeId)) {
    const alloc = createAllocator(content);
    target = { ...concept, id: alloc.conceptId(), code: alloc.itemCode() };
    next = replaceNode(next, nodeId, (current) => ({ ...current, conceptId: target.id }));
  }
  next = withConcept(next, {
    ...target,
    decomposition: [],
    prices: [formatDecimal(price, 6), ...target.prices.slice(1)],
  });
  return collectGarbage(next);
}

/**
 * Copies a concept (and its decomposition components) from another document. Equal concepts
 * with the same code are reused; a different concept with a taken code gets a new code.
 */
export function copyConcept<T extends ConstructionContent>(
  target: T,
  source: ConstructionContent,
  sourceConceptId: string,
  alloc: Allocator = createAllocator(target),
  copied = new Map<string, string>(),
): { document: T; conceptId: string } {
  let document = target;
  const copy = (id: string): string => {
    const existing = copied.get(id);
    if (existing) return existing;
    const concept = source.concepts[id];
    if (!concept) throw new Error('El concepto de origen no existe.');
    const decomposition = concept.decomposition.map((line) => ({
      ...line,
      conceptId: copy(line.conceptId),
    }));
    const same = Object.values(document.concepts).find(
      (candidate) =>
        bareCode(candidate.code) === bareCode(concept.code) &&
        candidate.summary === concept.summary &&
        candidate.unit === concept.unit &&
        JSON.stringify(candidate.prices) === JSON.stringify(concept.prices) &&
        JSON.stringify(candidate.decomposition) === JSON.stringify(decomposition),
    );
    if (same) {
      copied.set(id, same.id);
      return same.id;
    }
    const newId = alloc.conceptId();
    const clone: FiebdcConcept = {
      ...structuredClone(concept),
      id: newId,
      code: alloc.claimCode(concept.code),
      decomposition,
    };
    delete clone.synonyms;
    document = withConcept(document, clone);
    copied.set(id, newId);
    return newId;
  };
  const conceptId = copy(sourceConceptId);
  return { document, conceptId };
}

/** Points an item to a copy of a catalog concept, keeping its quantity and measurements. */
export function applyCatalogConcept<T extends ConstructionContent>(
  content: T,
  nodeId: string,
  catalog: ConstructionContent,
  catalogConceptId: string,
  catalogChapterId?: string,
): T {
  locate(content, nodeId);
  const { document, conceptId } = copyConcept(content, catalog, catalogConceptId);
  const concept = document.concepts[conceptId]!;
  const tagged = withConcept(document, {
    ...concept,
    source: { catalogConceptId, ...(catalogChapterId ? { catalogChapterId } : {}) },
  });
  return collectGarbage(replaceNode(tagged, nodeId, (node) => ({ ...node, conceptId })));
}

/** Appends whole chapters in one edit (guided structure, templates, BC3 merges). */
export function appendChapters<T extends ConstructionContent>(
  content: T,
  chapters: ChapterInput[],
  catalog?: ConstructionContent,
): T {
  let document = content;
  for (const chapter of chapters) {
    const added = addChapter(document, chapter.name, {
      ...(chapter.catalogChapterId ? { catalogChapterId: chapter.catalogChapterId } : {}),
    });
    document = added.document;
    for (const item of chapter.items) {
      const created = addItem(document, added.chapterId, item);
      document = created.document;
      if (catalog && item.catalogConceptId && catalog.concepts[item.catalogConceptId]) {
        document = applyCatalogConcept(
          document,
          created.nodeId,
          catalog,
          item.catalogConceptId,
          chapter.catalogChapterId,
        );
      }
    }
  }
  return document;
}

/** Catalog edit: adds a reusable concept to a chapter. */
export function addCatalogConcept<T extends ConstructionContent>(
  content: T,
  chapterId: string,
  input: ItemInput,
): { document: T; conceptId: string } {
  const { document, nodeId } = addItem(content, chapterId, { ...input, quantity: 1 });
  return { document, conceptId: locate(document, nodeId).conceptId };
}

/** Catalog edit: concepts are reusable, so every occurrence sees the change. */
export function updateCatalogConcept<T extends ConstructionContent>(
  content: T,
  conceptId: string,
  patch: ItemInput,
): T {
  const concept = content.concepts[conceptId];
  if (!concept) throw new Error('No se encuentra la partida del catálogo.');
  const next: FiebdcConcept = { ...concept };
  if (patch.description !== undefined) next.summary = patch.description;
  if (patch.unit !== undefined) next.unit = normalizeUnit(patch.unit);
  if (patch.price !== undefined) {
    if (concept.decomposition.length)
      throw new Error('El precio de esta partida se calcula con su descomposición.');
    next.prices = [amountText(patch.price, 'El precio'), ...concept.prices.slice(1)];
  }
  if (patch.cost !== undefined) next.cost = amountText(patch.cost, 'El coste');
  return withConcept(content, next);
}

export function removeCatalogConcept<T extends ConstructionContent>(
  content: T,
  chapterId: string,
  conceptId: string,
): T {
  const parentMatches = (parent: FiebdcNode | null) =>
    chapterId === ROOT_CHAPTER_ID ? parent === null : parent?.id === chapterId;
  const doomed = new Set<string>();
  walkNodes(content.tree, (node, parent) => {
    if (node.conceptId === conceptId && parentMatches(parent)) doomed.add(node.id);
  });
  if (!doomed.size) return content;
  return collectGarbage({
    ...content,
    tree: mapNodes(content.tree, (node) => (doomed.has(node.id) ? null : node)),
  });
}

/** Chapter node whose concept summary matches a name (normalized), at any depth. */
export function findChapterByName(content: ConstructionContent, name: string): FiebdcNode | null {
  const wanted = normalizeText(name);
  let found: FiebdcNode | null = null;
  walkNodes(content.tree, (node) => {
    const concept = content.concepts[node.conceptId];
    if (!found && isChapterNode(node, concept) && normalizeText(concept?.summary ?? '') === wanted)
      found = node;
  });
  return found;
}

export interface MergeResult<T> {
  document: T;
  addedParts: number;
  addedConcepts: number;
}

/**
 * Merges selected chapters/items of a source document into a catalog. Chapters match by
 * normalized name; items already present (same normalized description and unit) are skipped,
 * so existing custom prices are never overwritten and retries never duplicate.
 */
export function mergeIntoCatalog<T extends ConstructionContent>(
  target: T,
  source: ConstructionContent,
  include: (chapterName: string, item?: FiebdcConcept) => boolean = () => true,
): MergeResult<T> {
  let document = target;
  let addedParts = 0;
  let addedConcepts = 0;
  const copied = new Map<string, string>();
  const visit = (node: FiebdcNode, targetParent: string, override?: FiebdcConcept) => {
    const concept = override ?? source.concepts[node.conceptId];
    if (!concept) return;
    if (!isChapterNode(node, concept)) return;
    if (!include(concept.summary)) return;
    let chapter = findChapterByName(document, concept.summary);
    if (!chapter) {
      const added = addChapter(document, concept.summary, { parentId: targetParent });
      document = added.document;
      chapter = locate(document, added.chapterId);
      addedParts++;
    }
    const chapterId = chapter.id;
    for (const child of node.children) {
      const item = source.concepts[child.conceptId];
      if (!item) continue;
      if (isChapterNode(child, item)) {
        visit(child, chapterId);
        continue;
      }
      if (!include(concept.summary, item)) continue;
      const current = locate(document, chapterId);
      const present = current.children.some((existing) => {
        const candidate = document.concepts[existing.conceptId];
        return (
          candidate &&
          candidate.unit === item.unit &&
          normalizeText(candidate.summary) === normalizeText(item.summary)
        );
      });
      if (present) continue;
      const alloc = createAllocator(document);
      const copy = copyConcept(document, source, item.id, alloc, copied);
      document = insertNode(copy.document, chapterId, {
        id: alloc.nodeId(),
        conceptId: copy.conceptId,
        factor: '',
        quantity: '1',
        children: [],
      });
      addedConcepts++;
    }
  };
  source.tree.forEach((node) => visit(node, ROOT_CHAPTER_ID));
  const looseItems = source.tree.filter(
    (node) => !isChapterNode(node, source.concepts[node.conceptId]),
  );
  if (looseItems.length) {
    const virtualConcept = '__loose__';
    visit(
      {
        id: '__loose__',
        conceptId: virtualConcept,
        factor: '',
        quantity: '1',
        children: looseItems,
      },
      ROOT_CHAPTER_ID,
      {
        id: virtualConcept,
        code: 'SINCAP#',
        unit: '',
        summary: ROOT_CHAPTER_NAME,
        prices: [],
        dates: [],
        type: '0',
        decomposition: [],
      },
    );
  }
  return { document, addedParts, addedConcepts };
}

/** Numeric quantity of an occurrence from its yield (no measurement). */
export function nodeYield(node: FiebdcNode) {
  return parseDecimal(node.quantity, 0) ?? 0;
}
