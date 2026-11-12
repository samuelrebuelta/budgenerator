import { isDecimalText } from './decimal.js';
import type {
  ConstructionContent,
  ConstructionDocumentIssue,
  FiebdcConcept,
  FiebdcNode,
} from './types.js';

export const ROOT_MARKER = '##';
export const CHAPTER_MARKER = '#';

export function isRootCode(code: string) {
  return code.endsWith(ROOT_MARKER);
}

export function isChapterCode(code: string) {
  return code.endsWith(CHAPTER_MARKER) && !isRootCode(code);
}

/** Codes are compared without the trailing chapter/root markers, as FIEBDC references allow. */
export function bareCode(code: string) {
  return code.replace(/#+$/, '');
}

export function isPercentageCode(code: string) {
  return code.includes('%');
}

export function isChapterNode(node: FiebdcNode, concept: FiebdcConcept | undefined) {
  return node.children.length > 0 || (concept ? isChapterCode(concept.code) : false);
}

export function walkNodes(
  nodes: readonly FiebdcNode[],
  visit: (node: FiebdcNode, parent: FiebdcNode | null, depth: number) => void,
  parent: FiebdcNode | null = null,
  depth = 0,
) {
  for (const node of nodes) {
    visit(node, parent, depth);
    walkNodes(node.children, visit, node, depth + 1);
  }
}

function optionalDecimal(value: string | undefined) {
  return value === undefined || value.trim() === '' || isDecimalText(value);
}

/** Structural invariants of the canonical document. An empty list means it is consistent. */
export function validateConstructionContent(
  content: ConstructionContent,
): ConstructionDocumentIssue[] {
  const issues: ConstructionDocumentIssue[] = [];
  const concepts = content.concepts;
  const codes = new Map<string, string>();

  for (const [key, concept] of Object.entries(concepts)) {
    if (!concept.id.trim() || concept.id !== key)
      issues.push({
        code: 'invalid-concept-id',
        message: `El concepto ${concept.code || key} no tiene un identificador interno válido.`,
      });
    for (const code of [concept.code, ...(concept.synonyms ?? [])]) {
      const bare = bareCode(code);
      if (!bare.trim()) {
        issues.push({
          code: 'invalid-concept-id',
          message: 'Todo concepto necesita un código FIEBDC.',
        });
        continue;
      }
      const previous = codes.get(bare);
      if (previous && previous !== concept.id)
        issues.push({
          code: 'duplicate-concept-code',
          codeReference: code,
          message: `El código FIEBDC ${code} identifica más de un concepto.`,
        });
      else codes.set(bare, concept.id);
    }
    if (concept.prices.some((price) => !optionalDecimal(price)) || !optionalDecimal(concept.cost))
      issues.push({
        code: 'invalid-number',
        codeReference: concept.code,
        message: `El precio del concepto ${concept.code} no es numérico.`,
      });
    for (const line of concept.decomposition) {
      if (!concepts[line.conceptId])
        issues.push({
          code: 'unknown-concept-reference',
          codeReference: concept.code,
          message: `La descomposición de ${concept.code} referencia un concepto inexistente.`,
        });
      if (!optionalDecimal(line.factor) || !optionalDecimal(line.yield))
        issues.push({
          code: 'invalid-number',
          codeReference: concept.code,
          message: `La descomposición de ${concept.code} contiene un factor o rendimiento no numérico.`,
        });
    }
  }

  if (!concepts[content.rootConceptId])
    issues.push({ code: 'missing-root', message: 'El documento no tiene concepto raíz.' });

  const nodeIds = new Set<string>();
  walkNodes(content.tree, (node) => {
    if (nodeIds.has(node.id))
      issues.push({
        code: 'duplicate-node-id',
        message: `El identificador de ocurrencia ${node.id} está repetido.`,
      });
    nodeIds.add(node.id);
    const concept = concepts[node.conceptId];
    if (!concept)
      issues.push({
        code: 'unknown-concept-reference',
        message: 'La estructura referencia un concepto inexistente.',
      });
    else if (concept.id === content.rootConceptId)
      issues.push({
        code: 'invalid-structure',
        codeReference: concept.code,
        message: 'El concepto raíz no puede aparecer dentro de la estructura.',
      });
    if (!optionalDecimal(node.quantity) || !optionalDecimal(node.factor))
      issues.push({
        code: 'invalid-number',
        codeReference: concept?.code,
        message: `La cantidad de ${concept?.code ?? node.id} no es numérica.`,
      });
  });

  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      issues.push({
        code: 'cyclic-decomposition',
        codeReference: concepts[id]?.code,
        message: `La descomposición del concepto ${concepts[id]?.code ?? id} contiene un ciclo.`,
      });
      return;
    }
    visiting.add(id);
    for (const line of concepts[id]?.decomposition ?? []) visit(line.conceptId);
    visiting.delete(id);
    done.add(id);
  };
  Object.keys(concepts).forEach(visit);
  return issues;
}
