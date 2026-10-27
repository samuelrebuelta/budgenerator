import type {
  ConstructionDocument,
  FiebdcConcept,
  FiebdcMeasurementLine,
  FiebdcNode,
} from './types';

export type EditableFiebdcConcept = Pick<FiebdcConcept, 'summary' | 'unit' | 'prices' | 'texts'>;
export type FiebdcMeasurementFactor = 'units' | 'length' | 'breadth' | 'height';

/** Edits the reusable concept in place in the graph; every occurrence keeps its identity. */
export function updateConstructionConcept(
  document: ConstructionDocument,
  code: string,
  patch: Partial<EditableFiebdcConcept>,
): ConstructionDocument {
  const concept = Object.values(document.concepts).find((item) => item.codes.includes(code));
  if (!concept) throw new Error(`No existe el concepto FIEBDC ${code}.`);

  return {
    ...document,
    concepts: {
      ...document.concepts,
      [concept.id]: { ...concept, ...patch },
    },
  };
}

function updateNode(
  node: FiebdcNode,
  nodeId: string,
  measurements: FiebdcMeasurementLine[],
): { node: FiebdcNode; found: boolean } {
  if (node.id === nodeId) return { node: { ...node, measurements }, found: true };

  let found = false;
  const children = node.children.map((child) => {
    const result = updateNode(child, nodeId, measurements);
    found ||= result.found;
    return result.node;
  });
  return found ? { node: { ...node, children }, found } : { node, found };
}

/** Measurements belong to a budget occurrence, so editing one never changes sibling occurrences. */
export function updateConstructionNodeMeasurements(
  document: ConstructionDocument,
  nodeId: string,
  measurements: FiebdcMeasurementLine[],
): ConstructionDocument {
  let found = false;
  const roots = document.roots.map((root) => {
    const result = updateNode(root, nodeId, measurements);
    found ||= result.found;
    return result.node;
  });
  if (!found) throw new Error(`No existe la ocurrencia ${nodeId}.`);
  return { ...document, roots };
}

/** A dimensional change makes the serialized explicit total stale; omit it so dimensions win. */
export function updateConstructionMeasurementFactor(
  document: ConstructionDocument,
  nodeId: string,
  index: number,
  factor: FiebdcMeasurementFactor,
  raw: string,
): ConstructionDocument {
  let found = false;
  const roots = document.roots.map((root) => {
    const node = findNode(root, nodeId);
    if (!node || found) return root;
    found = true;
    const measurements = node.measurements.map((line, current) => {
      if (current !== index) return line;
      const updated = { ...line, [factor]: { raw } };
      delete updated.total;
      return updated;
    });
    return replaceNodeMeasurements(root, nodeId, measurements);
  });
  if (!found) throw new Error(`No existe la ocurrencia ${nodeId}.`);
  return { ...document, roots };
}

function findNode(node: FiebdcNode, nodeId: string): FiebdcNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const match = findNode(child, nodeId);
    if (match) return match;
  }
  return null;
}

function replaceNodeMeasurements(
  node: FiebdcNode,
  nodeId: string,
  measurements: FiebdcMeasurementLine[],
): FiebdcNode {
  if (node.id === nodeId) return { ...node, measurements };
  const children = node.children.map((child) =>
    replaceNodeMeasurements(child, nodeId, measurements),
  );
  return children.some((child, index) => child !== node.children[index])
    ? { ...node, children }
    : node;
}
