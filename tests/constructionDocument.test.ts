import { describe, expect, it } from 'vitest';
import {
  addChapter,
  addItem,
  calculateConstructionTotals,
  cloneAsKind,
  createEmptyDocument,
  decodeContent,
  encodeContent,
  evaluateMeasurementExpression,
  formatDecimal,
  measurementLinesTotal,
  projectWorkItems,
  removeNode,
  roundTo,
  splitUtf8,
  updateBusiness,
  updateItem,
  utf8ByteLength,
  validateConstructionContent,
  walkNodes,
  type ConstructionDocument,
} from '../src/entities/construction-document/model';
import { sampleDocument } from './fixtures';

describe('decimal policy', () => {
  it('rounds half away from zero without binary noise', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(8.5 * 9.79, 2)).toBe(83.22);
    expect(roundTo(-2.345, 2)).toBe(-2.35);
    expect(formatDecimal(12.5)).toBe('12.5');
    expect(formatDecimal(0.1 + 0.2)).toBe('0.3');
  });

  it('adds line amounts rounded to the cent, then IVA on the subtotal', () => {
    let document = createEmptyDocument('budget', { ivaRate: 0.21 });
    const chapter = addChapter(document, 'Varios');
    document = chapter.document;
    for (const [quantity, price] of [
      [3, 0.335],
      [1.5, 19.99],
      [7, 1.005],
    ] as const)
      document = addItem(document, chapter.chapterId, {
        description: 'x',
        quantity,
        price,
      }).document;
    const totals = calculateConstructionTotals(document);
    // 3 × 0.34 = 1.02; 1.5 × 19.99 = 29.985 → 29.99; 7 × 1.01 = 7.07
    expect(totals.raw).toBe(38.08);
    expect(totals.iva).toBe(8);
    expect(totals.total).toBe(46.08);
  });

  it('applies surcharges per unit price and discounts on the subtotal', () => {
    const base = sampleDocument();
    const surcharged = calculateConstructionTotals(
      updateBusiness(base, { adjustment: { multiplier: 1.2, reason: '' } }),
    );
    expect(surcharged.subtotal).toBe(32.25); // 2.5 × 12.90
    const discounted = calculateConstructionTotals(
      updateBusiness(base, { adjustment: { multiplier: 0.9, reason: '' } }),
    );
    expect(discounted.subtotal).toBe(24.19);
    expect(discounted.discount).toBe(-2.69);
  });
});

describe('measurement lines', () => {
  it('multiplies present factors, ignores subtotals and evaluates expressions', () => {
    expect(
      measurementLinesTotal({
        lines: [
          { type: '', comment: 'a', units: '2', length: '3', height: '2.5' },
          { type: '1', comment: 'subtotal' },
          { type: '3', comment: '(a+b)*c', units: '1', length: '2', width: '4' },
          { type: '', comment: 'solo comentario' },
        ],
      }),
    ).toBe(27);
    expect(evaluateMeasurementExpression('a*b^2-d/2', { a: 2, b: 3, c: 0, d: 4 })).toBe(16);
    expect(evaluateMeasurementExpression('a*sqrt(b)', { a: 1, b: 4, c: 0, d: 0 })).toBeNull();
    expect(evaluateMeasurementExpression('1/0', { a: 0, b: 0, c: 0, d: 0 })).toBeNull();
  });
});

describe('edit operations', () => {
  it('copies a shared concept on write so other occurrences keep their values', () => {
    let document = sampleDocument();
    const chapterId = document.tree[0]!.id;
    const first = document.tree[0]!.children[0]!;
    document = {
      ...document,
      tree: [
        {
          ...document.tree[0]!,
          children: [...document.tree[0]!.children, { ...first, id: 'n99', quantity: '4' }],
        },
      ],
    };
    expect(projectWorkItems(document)[0]!.tasks.every((task) => task.shared)).toBe(true);
    document = updateItem(document, 'n99', { price: 20 });
    const tasks = projectWorkItems(document)[0]!.tasks;
    expect(tasks.map((task) => task.price)).toEqual([10.75, 20]);
    expect(tasks[0]!.conceptId).not.toBe(tasks[1]!.conceptId);
    expect(tasks.every((task) => !task.shared)).toBe(true);
    expect(chapterId).toBe(projectWorkItems(document)[0]!.id);
  });

  it('removes unreachable concepts and never mutates the input', () => {
    const document = sampleDocument();
    const snapshot = JSON.stringify(document);
    const next = removeNode(document, document.tree[0]!.id);
    expect(JSON.stringify(document)).toBe(snapshot);
    expect(Object.keys(next.concepts)).toEqual([next.rootConceptId]);
  });

  it('keeps IDs and codes unique when adding many items', () => {
    let document: ConstructionDocument = createEmptyDocument('budget');
    const chapter = addChapter(document, 'A');
    document = chapter.document;
    for (let index = 0; index < 30; index++)
      document = addItem(document, chapter.chapterId).document;
    const ids: string[] = [];
    walkNodes(document.tree, (node) => ids.push(node.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateConstructionContent(document)).toEqual([]);
  });

  it('converts between template and budget keeping the FIEBDC content', () => {
    const template = cloneAsKind(sampleDocument(), 'template', {
      ...sampleDocument().business,
      name: 'Plantilla',
    });
    expect(template.concepts[template.rootConceptId]!.code).toBe('PLANTILLA##');
    expect(template.header.informationType).toBe(2);
    expect(projectWorkItems(template)[0]!.tasks[0]!.description).toBe('Pintura de paredes');
  });
});

describe('chunked storage', () => {
  it('splits by UTF-8 bytes without breaking surrogate pairs', () => {
    const text = 'añ😀'.repeat(1000);
    const chunks = splitUtf8(text, 100);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every((chunk) => utf8ByteLength(chunk) <= 100)).toBe(true);
  });

  it('round-trips content and rejects invalid documents or schema versions', () => {
    const document = sampleDocument();
    const { business: _business, ...content } = document;
    void _business;
    expect(decodeContent(encodeContent(content))).toEqual(content);
    const broken = { ...content, tree: [{ ...content.tree[0]!, conceptId: 'missing' }] };
    expect(() => encodeContent(broken)).toThrow();
    expect(() => decodeContent([JSON.stringify({ ...content, schemaVersion: 2 })])).toThrow();
  });

  it('reports documents over the storage limit', () => {
    let document: ConstructionDocument = createEmptyDocument('catalog');
    const chapter = addChapter(document, 'Grande');
    document = chapter.document;
    const huge = 'x'.repeat(800_000);
    for (let index = 0; index < 10; index++)
      document = addItem(document, chapter.chapterId, { description: `${index}${huge}` }).document;
    const { business: _b, ...content } = document;
    void _b;
    expect(() => encodeContent(content)).toThrow(/supera el máximo/);
  });
});
