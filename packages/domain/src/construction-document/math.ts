import { money, parseDecimal, roundTo } from './decimal.js';
import { bareCode, isChapterNode, isPercentageCode, walkNodes } from './invariants.js';
import { measurementLinesTotal } from './measurement.js';
import type {
  ConstructionContent,
  ConstructionDocument,
  FiebdcConcept,
  FiebdcNode,
} from './types.js';

export const DEFAULT_IVA_RATE = 0.1;

export interface ConstructionMathIssue {
  code: 'invalid-number' | 'unknown-concept-reference' | 'cyclic-decomposition';
  message: string;
  codeReference?: string;
}

export interface NodeAmount {
  nodeId: string;
  conceptId: string;
  chapter: boolean;
  quantity: number;
  /** Unit price before the business adjustment. */
  unitPrice: number;
  /** Unit price shown to the client (adjustment > 1 is applied per unit). */
  adjustedUnitPrice: number;
  /** Amount without adjustment. */
  rawAmount: number;
  /** Amount with the per-unit adjustment. */
  amount: number;
  cost: number;
}

export interface ConstructionTotals {
  valid: boolean;
  issues: ConstructionMathIssue[];
  nodes: Map<string, NodeAmount>;
  /** Σ line amounts before any adjustment: the FIEBDC execution budget (PEM). */
  raw: number;
  subtotal: number;
  iva: number;
  total: number;
  discount: number;
  cost: number;
}

/** Unit price of every concept, computed from its decomposition when it has one. */
export interface RateResolverOptions {
  /**
   * Con `true` (lo normal) el precio declarado de un concepto manda sobre su
   * descomposición. La importación lo pone en `false` para poder avisar de que el
   * archivo se contradice (BG-016).
   */
  preferDeclared?: boolean;
}

export function createRateResolver(
  content: ConstructionContent,
  { preferDeclared = true }: RateResolverOptions = {},
) {
  const issues: ConstructionMathIssue[] = [];
  const rates = new Map<string, number>();
  const stack = new Set<string>();
  const priceDecimals = content.settings.decimals.price;

  const directPrice = (concept: FiebdcConcept) => {
    const raw = concept.prices[0];
    const value = parseDecimal(raw, 0);
    if (value === null) {
      issues.push({
        code: 'invalid-number',
        codeReference: concept.code,
        message: `El precio de ${concept.code} no es numérico.`,
      });
      return 0;
    }
    return value;
  };

  const rate = (conceptId: string): number => {
    const cached = rates.get(conceptId);
    if (cached !== undefined) return cached;
    const concept = content.concepts[conceptId];
    if (!concept) {
      issues.push({
        code: 'unknown-concept-reference',
        message: 'Falta un concepto referenciado por la descomposición.',
      });
      return 0;
    }
    if (!concept.decomposition.length) {
      const value = directPrice(concept);
      rates.set(conceptId, value);
      return value;
    }
    // BG-016: el precio del `~C` es el que el programa de origen imprimió y el cliente
    // firmó; la descomposición es el detalle, y nunca cuadra al céntimo porque cada
    // programa redondea a su manera. Se calcula solo cuando no hay precio declarado,
    // que es el caso de los conceptos de porcentaje (`%`, `%CI`), con el precio a cero.
    const declared = preferDeclared ? directPrice(concept) : 0;
    if (declared > 0) {
      rates.set(conceptId, declared);
      return declared;
    }
    if (stack.has(conceptId)) {
      issues.push({
        code: 'cyclic-decomposition',
        codeReference: concept.code,
        message: `La descomposición de ${concept.code} es cíclica.`,
      });
      return 0;
    }
    stack.add(conceptId);
    const lines: { code: string; amount: number; percentage: boolean }[] = [];
    for (const line of concept.decomposition) {
      const child = content.concepts[line.conceptId];
      const factor = parseDecimal(line.factor, 1);
      const yieldValue = parseDecimal(line.yield, 1);
      if (factor === null || yieldValue === null || !child) {
        issues.push({
          code: child ? 'invalid-number' : 'unknown-concept-reference',
          codeReference: concept.code,
          message: `La descomposición de ${concept.code} no se puede calcular.`,
        });
        continue;
      }
      if (isPercentageCode(child.code)) {
        const masks = (line.percentageCodes ?? []).map((mask) =>
          bareCode(mask).replace(/[*%?]+$/, ''),
        );
        const base = lines
          .filter((item) => !item.percentage)
          .filter((item) => !masks.length || masks.some((mask) => item.code.startsWith(mask)))
          .reduce((sum, item) => sum + item.amount, 0);
        // Two conventions in the wild for the rate of a percentage concept: Presto writes
        // it as the concept price (0.03 = 3 %) with yield 1; Arquímedes leaves that price
        // at zero and puts the rate in the decomposition yield. Falling back to 1 covers
        // the second without changing the first.
        lines.push({
          code: bareCode(child.code),
          amount: factor * yieldValue * (directPrice(child) || 1) * base,
          percentage: true,
        });
        continue;
      }
      lines.push({
        code: bareCode(child.code),
        amount: factor * yieldValue * rate(child.id),
        percentage: false,
      });
    }
    stack.delete(conceptId);
    const value = roundTo(
      lines.reduce((sum, item) => sum + item.amount, 0),
      priceDecimals,
    );
    rates.set(conceptId, value);
    return value;
  };
  return { rate, issues };
}

/**
 * Quantity of an item occurrence. The measurement replaces the `~D` yield when there is one,
 * but the `~D` factor still multiplies it: that is where a swell coefficient lives (1,3 sobre
 * los m³ medidos de tierras, por ejemplo), and dropping it loses that part of the budget.
 */
export function nodeQuantity(node: FiebdcNode, quantityDecimals = 2): number | null {
  const factor = parseDecimal(node.factor, 1);
  if (factor === null) return null;
  if (node.measurement?.lines.length) {
    // BG-016: `total` solo está cuando lo declaró el archivo importado; al editar las
    // líneas se borra (`setMeasurementLines`), y entonces manda su suma.
    const declared = parseDecimal(node.measurement.total ?? '', null);
    const measured = declared ?? measurementLinesTotal(node.measurement);
    if (measured === null) return null;
    return factor === 1
      ? roundTo(measured, quantityDecimals)
      : roundTo(factor * measured, quantityDecimals);
  }
  const quantity = parseDecimal(node.quantity, 0);
  if (quantity === null) return null;
  return factor === 1 ? quantity : roundTo(factor * quantity, quantityDecimals);
}

export function adjustedPrice(price: number, multiplier = 1) {
  return money(price * Math.max(1, multiplier));
}

/** Derived totals; never persisted. Follows the app policy: rounded line amounts, then IVA. */
export function calculateConstructionTotals(
  document: Pick<ConstructionDocument, 'business'> & ConstructionContent,
): ConstructionTotals {
  const { rate, issues } = createRateResolver(document);
  const multiplier = document.business.adjustment?.multiplier ?? 1;
  const { quantity: quantityDecimals, amount: amountDecimals } = document.settings.decimals;
  const nodes = new Map<string, NodeAmount>();
  let raw = 0;
  let lines = 0;
  let cost = 0;

  const visitNode = (node: FiebdcNode): NodeAmount => {
    const concept = document.concepts[node.conceptId];
    if (!concept)
      issues.push({
        code: 'unknown-concept-reference',
        message: 'La estructura referencia un concepto inexistente.',
      });
    if (concept && isChapterNode(node, concept)) {
      const children = node.children.map(visitNode);
      const result: NodeAmount = {
        nodeId: node.id,
        conceptId: node.conceptId,
        chapter: true,
        quantity: 1,
        unitPrice: roundTo(
          children.reduce((sum, child) => sum + child.rawAmount, 0),
          amountDecimals,
        ),
        adjustedUnitPrice: 0,
        rawAmount: roundTo(
          children.reduce((sum, child) => sum + child.rawAmount, 0),
          amountDecimals,
        ),
        amount: roundTo(
          children.reduce((sum, child) => sum + child.amount, 0),
          amountDecimals,
        ),
        cost: money(children.reduce((sum, child) => sum + child.cost, 0)),
      };
      result.adjustedUnitPrice = result.amount;
      nodes.set(node.id, result);
      return result;
    }
    const quantity = nodeQuantity(node, quantityDecimals);
    if (quantity === null)
      issues.push({
        code: 'invalid-number',
        codeReference: concept?.code,
        message: `La medición de ${concept?.code ?? node.id} no se puede calcular.`,
      });
    const qty = quantity ?? 0;
    const unitPrice = concept ? rate(concept.id) : 0;
    const adjustedUnitPrice = adjustedPrice(unitPrice, multiplier);
    const unitCost = parseDecimal(concept?.cost, 0) ?? 0;
    const result: NodeAmount = {
      nodeId: node.id,
      conceptId: node.conceptId,
      chapter: false,
      quantity: qty,
      unitPrice,
      adjustedUnitPrice,
      rawAmount: roundTo(qty * money(unitPrice), amountDecimals),
      amount: roundTo(qty * adjustedUnitPrice, amountDecimals),
      cost: money(qty * unitCost),
    };
    raw += result.rawAmount;
    lines += result.amount;
    cost += result.cost;
    nodes.set(node.id, result);
    return result;
  };
  document.tree.forEach(visitNode);

  raw = money(raw);
  lines = money(lines);
  const subtotal = multiplier < 1 ? money(raw * multiplier) : lines;
  const ivaRate = document.business.ivaRate ?? DEFAULT_IVA_RATE;
  const iva = money(subtotal * ivaRate);
  return {
    valid: issues.length === 0,
    issues,
    nodes,
    raw,
    subtotal,
    iva,
    total: money(subtotal + iva),
    discount: money(subtotal - raw),
    cost: money(cost),
  };
}

/** Item occurrences (non chapter nodes) in document order. */
export function listItemNodes(content: ConstructionContent): FiebdcNode[] {
  const items: FiebdcNode[] = [];
  walkNodes(content.tree, (node) => {
    if (!isChapterNode(node, content.concepts[node.conceptId])) items.push(node);
  });
  return items;
}
