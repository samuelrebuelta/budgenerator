import type { BudgetTask, CatalogConcept, CatalogPart, WorkItem } from '../types/index.js';
import { parseDecimal } from './decimal.js';
import { isChapterNode, walkNodes } from './invariants.js';
import { calculateConstructionTotals, type ConstructionTotals } from './math.js';
import type { ConstructionContent, ConstructionDocument, FiebdcNode } from './types.js';

/** Virtual chapter grouping items placed directly under the root concept. */
export const ROOT_CHAPTER_ID = '_root';
export const ROOT_CHAPTER_NAME = 'Partidas sin capítulo';

const totalsCache = new WeakMap<object, ConstructionTotals>();

/** Memoized by document identity: documents are immutable values. */
export function documentTotals(document: ConstructionDocument): ConstructionTotals {
  let totals = totalsCache.get(document);
  if (!totals) {
    totals = calculateConstructionTotals(document);
    totalsCache.set(document, totals);
  }
  return totals;
}

export function countConceptUsage(content: ConstructionContent): Map<string, number> {
  const usage = new Map<string, number>();
  walkNodes(content.tree, (node) =>
    usage.set(node.conceptId, (usage.get(node.conceptId) ?? 0) + 1),
  );
  return usage;
}

interface ChapterSlot {
  node: FiebdcNode | null;
  depth: number;
  items: FiebdcNode[];
}

/** Chapters in depth-first order with their direct item children. */
export function chapterSlots(content: ConstructionContent): ChapterSlot[] {
  const slots: ChapterSlot[] = [];
  const rootItems = content.tree.filter(
    (node) => !isChapterNode(node, content.concepts[node.conceptId]),
  );
  if (rootItems.length) slots.push({ node: null, depth: 0, items: rootItems });
  const visit = (node: FiebdcNode, depth: number) => {
    if (!isChapterNode(node, content.concepts[node.conceptId])) return;
    slots.push({
      node,
      depth,
      items: node.children.filter(
        (child) => !isChapterNode(child, content.concepts[child.conceptId]),
      ),
    });
    node.children.forEach((child) => visit(child, depth + 1));
  };
  content.tree.forEach((node) => visit(node, 0));
  return slots;
}

const workItemsCache = new WeakMap<object, WorkItem[]>();

/** Budget/template editor view. Task IDs are node IDs; chapter IDs are chapter node IDs. */
export function projectWorkItems(document: ConstructionDocument): WorkItem[] {
  const cached = workItemsCache.get(document);
  if (cached) return cached;
  const totals = documentTotals(document);
  const usage = countConceptUsage(document);
  const result = chapterSlots(document).map((slot): WorkItem => {
    const chapterConcept = slot.node ? document.concepts[slot.node.conceptId] : undefined;
    const catalogPartId = chapterConcept?.source?.catalogChapterId;
    return {
      id: slot.node?.id ?? ROOT_CHAPTER_ID,
      code: chapterConcept?.code ?? '',
      name: slot.node ? (chapterConcept?.summary ?? '') : ROOT_CHAPTER_NAME,
      depth: slot.depth,
      ...(catalogPartId ? { catalogPartId } : {}),
      tasks: slot.items.map((node): BudgetTask => {
        const concept = document.concepts[node.conceptId];
        const amounts = totals.nodes.get(node.id);
        const catalogConceptId = concept?.source?.catalogConceptId;
        return {
          id: node.id,
          conceptId: node.conceptId,
          code: concept?.code ?? '',
          ...(catalogConceptId ? { catalogConceptId } : {}),
          description: concept?.summary ?? '',
          quantity: amounts?.quantity ?? 0,
          unit: concept?.unit ?? '',
          price: amounts?.unitPrice ?? 0,
          cost: parseDecimal(concept?.cost, 0) ?? 0,
          measured: !!node.measurement?.lines.length,
          composed: !!concept?.decomposition.length,
          shared: (usage.get(node.conceptId) ?? 0) > 1,
          ...(concept?.text ? { text: concept.text } : {}),
        };
      }),
    };
  });
  workItemsCache.set(document, result);
  return result;
}

const catalogCache = new WeakMap<object, CatalogPart[]>();

/** Catalog view: chapters with the concepts placed in them. Concept IDs are concept IDs. */
export function projectCatalogParts(content: ConstructionContent): CatalogPart[] {
  const cached = catalogCache.get(content);
  if (cached) return cached;
  const totals = calculateConstructionTotals({
    ...content,
    business: { name: '', clientName: '', address: '', date: '', budgetNumber: '', ivaRate: 0 },
  });
  const rateOf = (node: FiebdcNode) => totals.nodes.get(node.id)?.unitPrice ?? 0;
  const result = chapterSlots(content).map((slot): CatalogPart => {
    const chapterConcept = slot.node ? content.concepts[slot.node.conceptId] : undefined;
    return {
      id: slot.node?.id ?? ROOT_CHAPTER_ID,
      code: chapterConcept?.code ?? '',
      name: slot.node ? (chapterConcept?.summary ?? '') : ROOT_CHAPTER_NAME,
      depth: slot.depth,
      concepts: slot.items.flatMap((node): CatalogConcept[] => {
        const concept = content.concepts[node.conceptId];
        if (!concept) return [];
        return [
          {
            id: concept.id,
            code: concept.code,
            description: concept.summary,
            unit: concept.unit,
            basePrice: rateOf(node),
            cost: parseDecimal(concept.cost, 0) ?? 0,
            composed: concept.decomposition.length > 0,
          },
        ];
      }),
    };
  });
  catalogCache.set(content, result);
  return result;
}

/** Finds a node and its parent list by ID. */
export function findNode(
  nodes: readonly FiebdcNode[],
  id: string,
): { node: FiebdcNode; parent: FiebdcNode | null } | null {
  let found: { node: FiebdcNode; parent: FiebdcNode | null } | null = null;
  walkNodes(nodes, (node, parent) => {
    if (!found && node.id === id) found = { node, parent };
  });
  return found;
}
