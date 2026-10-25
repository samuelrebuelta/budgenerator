import type {
  ConstructionDocument,
  ConstructionDocumentIssue,
  FiebdcConcept,
  FiebdcNode,
} from './types';

function buildCodeIndex(document: ConstructionDocument) {
  const index = new Map<string, FiebdcConcept>();
  const duplicateCodes = new Set<string>();

  for (const concept of Object.values(document.concepts)) {
    if (!concept.id.trim()) continue;
    for (const code of concept.codes) {
      if (index.has(code) && index.get(code)?.id !== concept.id) duplicateCodes.add(code);
      else index.set(code, concept);
    }
  }

  return { index, duplicateCodes };
}

export function validateConstructionDocument(
  document: ConstructionDocument,
): ConstructionDocumentIssue[] {
  const issues: ConstructionDocumentIssue[] = [];
  const { index, duplicateCodes } = buildCodeIndex(document);

  if (document.kind === 'catalog' && document.header.informationType !== 1)
    issues.push({
      code: 'unsupported-information-type',
      message: 'El tipo FIEBDC de cabecera no corresponde a una base de precios.',
    });
  if (
    (document.kind === 'budget' || document.kind === 'template') &&
    document.header.informationType !== 2
  )
    issues.push({
      code: 'unsupported-information-type',
      message: 'El tipo FIEBDC de cabecera no corresponde a un presupuesto.',
    });

  for (const code of duplicateCodes)
    issues.push({
      code: 'duplicate-concept-code',
      codeReference: code,
      message: `El código FIEBDC ${code} identifica más de un concepto.`,
    });

  for (const concept of Object.values(document.concepts)) {
    if (!concept.id.trim())
      issues.push({
        code: 'invalid-concept-id',
        message: 'Todo concepto debe tener un ID interno.',
      });
    for (const line of concept.decomposition)
      if (!index.has(line.code))
        issues.push({
          code: 'unknown-concept-reference',
          codeReference: line.code,
          message: `La descomposición referencia el concepto inexistente ${line.code}.`,
        });
  }

  const nodeIds = new Set<string>();
  const visitNode = (node: FiebdcNode) => {
    if (nodeIds.has(node.id))
      issues.push({
        code: 'duplicate-node-id',
        message: `El ID de ocurrencia ${node.id} está repetido.`,
      });
    else nodeIds.add(node.id);
    if (!index.has(node.conceptCode))
      issues.push({
        code: 'unknown-concept-reference',
        codeReference: node.conceptCode,
        message: `La estructura referencia el concepto inexistente ${node.conceptCode}.`,
      });
    node.children.forEach(visitNode);
  };
  document.roots.forEach(visitNode);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitConcept = (code: string) => {
    if (visiting.has(code)) {
      issues.push({
        code: 'cyclic-decomposition',
        codeReference: code,
        message: `La descomposición del concepto ${code} contiene un ciclo.`,
      });
      return;
    }
    if (visited.has(code)) return;
    const concept = index.get(code);
    if (!concept) return;
    visiting.add(code);
    concept.decomposition.forEach((line) => visitConcept(line.code));
    visiting.delete(code);
    visited.add(code);
  };
  for (const code of index.keys()) visitConcept(code);

  return issues;
}
