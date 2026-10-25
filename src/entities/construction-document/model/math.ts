import { validateConstructionDocument } from './invariants';
import type {
  ConstructionDocument,
  FiebdcConcept,
  FiebdcNode,
} from './types';

export interface ConstructionTreeNode {
  id: string;
  conceptCode: string;
  summary: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  children: ConstructionTreeNode[];
}

export interface ConstructionMathIssue {
  code: 'invalid-number' | 'unknown-concept-reference' | 'cyclic-decomposition';
  message: string;
  codeReference?: string;
}

export interface ConstructionTotals {
  valid: boolean;
  total: number | null;
  tree: ConstructionTreeNode[];
  issues: ConstructionMathIssue[];
}

function decimal(raw: string | undefined): number | null {
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function measurementQuantity(node: FiebdcNode): number | null {
  if (!node.measurements.length) return null;
  let sum = 0;
  for (const line of node.measurements) {
    if (line.total) {
      const total = decimal(line.total.raw);
      if (total === null) return null;
      sum += total;
      continue;
    }
    const factors = [line.units, line.length, line.breadth, line.height].filter(Boolean);
    if (!factors.length) continue;
    let product = 1;
    for (const factor of factors) {
      const value = decimal(factor?.raw);
      if (value === null) return null;
      product *= value;
    }
    sum += product;
  }
  return sum;
}

function indexConcepts(document: ConstructionDocument): Map<string, FiebdcConcept> {
  return new Map(Object.values(document.concepts).flatMap((concept) => concept.codes.map((code) => [code, concept] as const)));
}

function mapInvariantIssue(issue: ReturnType<typeof validateConstructionDocument>[number]): ConstructionMathIssue | null {
  if (issue.code === 'unknown-concept-reference' || issue.code === 'cyclic-decomposition')
    return { code: issue.code, message: issue.message, codeReference: issue.codeReference };
  return null;
}

export function calculateConstructionDocument(document: ConstructionDocument): ConstructionTotals {
  const issues: ConstructionMathIssue[] = validateConstructionDocument(document)
    .map(mapInvariantIssue)
    .filter((issue): issue is ConstructionMathIssue => issue !== null);
  const concepts = indexConcepts(document);
  const rates = new Map<string, number>();
  const rateStack = new Set<string>();

  const getRate = (code: string): number => {
    if (rates.has(code)) return rates.get(code)!;
    const concept = concepts.get(code);
    if (!concept) {
      issues.push({ code: 'unknown-concept-reference', codeReference: code, message: `No se puede calcular: falta el concepto ${code}.` });
      return 0;
    }
    if (rateStack.has(code)) {
      issues.push({ code: 'cyclic-decomposition', codeReference: code, message: `No se puede calcular la descomposición cíclica de ${code}.` });
      return 0;
    }
    const directPrice = concept.prices[0]?.amount.raw;
    if (directPrice !== undefined) {
      const parsed = decimal(directPrice);
      if (parsed === null) {
        issues.push({ code: 'invalid-number', codeReference: code, message: `El precio de ${code} no es numérico: ${directPrice}.` });
        return 0;
      }
      rates.set(code, parsed);
      return parsed;
    }
    if (!concept.decomposition.length) {
      rates.set(code, 0);
      return 0;
    }
    rateStack.add(code);
    const rate = concept.decomposition.reduce((sum, line) => {
      const factor = decimal(line.factor.raw);
      const yieldValue = decimal(line.yield.raw);
      if (factor === null || yieldValue === null) {
        issues.push({ code: 'invalid-number', codeReference: code, message: `La descomposición de ${code} contiene un factor o rendimiento no numérico.` });
        return sum;
      }
      return sum + factor * yieldValue * getRate(line.code);
    }, 0);
    rateStack.delete(code);
    rates.set(code, rate);
    return rate;
  };

  const makeTreeNode = (node: FiebdcNode, inheritedQuantity: number): ConstructionTreeNode => {
    const concept = concepts.get(node.conceptCode);
    if (!concept) {
      issues.push({ code: 'unknown-concept-reference', codeReference: node.conceptCode, message: `No se puede calcular: falta el concepto ${node.conceptCode}.` });
    }
    const measured = measurementQuantity(node);
    if (measured === null && node.measurements.some((line) => line.total || line.units || line.length || line.breadth || line.height))
      issues.push({ code: 'invalid-number', codeReference: node.conceptCode, message: `Las mediciones de ${node.conceptCode} contienen valores no numéricos.` });
    const quantity = measured ?? inheritedQuantity;
    const unitPrice = getRate(node.conceptCode);
    const children = node.children.map((child, index) => {
      const edge = concept?.decomposition.filter((line) => line.code === child.conceptCode)[index];
      const factor = edge ? decimal(edge.factor.raw) : 1;
      const yieldValue = edge ? decimal(edge.yield.raw) : 1;
      if (factor === null || yieldValue === null)
        issues.push({ code: 'invalid-number', codeReference: child.conceptCode, message: `El factor o rendimiento de ${child.conceptCode} no es numérico.` });
      return makeTreeNode(child, quantity * (factor ?? 0) * (yieldValue ?? 0));
    });
    const summary = concept?.summary ?? '';
    const unit = concept?.unit ?? '';
    const amount = concept?.prices.length ? quantity * unitPrice : children.length ? children.reduce((sum, child) => sum + child.amount, 0) : quantity * unitPrice;
    return { id: node.id, conceptCode: node.conceptCode, summary, unit, quantity, unitPrice, amount, children };
  };

  const tree = document.roots.map((node) => makeTreeNode(node, 1));
  if (issues.length) return { valid: false, total: null, tree, issues };
  return { valid: true, total: tree.reduce((sum, node) => sum + node.amount, 0), tree, issues };
}

export function getConstructionTree(document: ConstructionDocument): ConstructionTreeNode[] {
  return calculateConstructionDocument(document).tree;
}
