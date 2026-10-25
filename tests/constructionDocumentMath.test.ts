import { describe, expect, it } from 'vitest';
import {
  calculateConstructionDocument,
  type ConstructionDocument,
} from '@/entities/construction-document/model';

const document: ConstructionDocument = {
  id: 'math-budget',
  schemaVersion: 1,
  kind: 'budget',
  header: {
    version: '3/2024',
    owner: 'BudGenerator',
    program: 'BudGenerator',
    title: 'Reforma',
    characterSet: 'ANSI',
    informationType: 2,
  },
  concepts: {
    work: {
      id: 'work',
      codes: ['##WORK'],
      type: 'chapter',
      summary: 'Obra',
      unit: '',
      prices: [],
      dates: [],
      texts: [],
      decomposition: [{ code: '#01', factor: { raw: '1' }, yield: { raw: '1' } }],
    },
    chapter: {
      id: 'chapter',
      codes: ['#01'],
      type: 'chapter',
      summary: 'Pavimentos',
      unit: '',
      prices: [],
      dates: [],
      texts: [],
      decomposition: [{ code: 'PAV001', factor: { raw: '1' }, yield: { raw: '1' } }],
    },
    paving: {
      id: 'paving',
      codes: ['PAV001'],
      type: 'work-unit',
      summary: 'Colocación',
      unit: 'm2',
      prices: [{ label: 'Venta', amount: { raw: '20,00' } }],
      dates: [],
      texts: [],
      decomposition: [],
    },
  },
  roots: [
    {
      id: 'root',
      conceptCode: '##WORK',
      children: [
        {
          id: 'chapter-node',
          conceptCode: '#01',
          children: [
            {
              id: 'paving-1',
              conceptCode: 'PAV001',
              children: [],
              measurements: [{ total: { raw: '12' } }],
            },
            {
              id: 'paving-2',
              conceptCode: 'PAV001',
              children: [],
              measurements: [{ units: { raw: '1' }, length: { raw: '2,5' } }],
            },
          ],
          measurements: [],
        },
      ],
      measurements: [],
    },
  ],
  coefficients: [],
  opaqueRecords: [],
  business: {},
};

describe('ConstructionDocument math', () => {
  it('calculates repeated occurrences and dimension-based quantities without mutating the source', () => {
    const result = calculateConstructionDocument(document);

    expect(result.valid).toBe(true);
    expect(result.total).toBe(290);
    expect(result.tree[0]?.children[0]?.children.map((node) => node.quantity)).toEqual([12, 2.5]);
    expect(document.roots[0]?.children[0]?.children[0]?.measurements[0]?.total?.raw).toBe('12');
  });

  it('calculates a unit rate from a decomposition when no direct price exists', () => {
    const composed = structuredClone(document);
    composed.concepts.paving!.prices = [];
    composed.concepts.paving!.decomposition = [
      { code: 'MAT001', factor: { raw: '2' }, yield: { raw: '1' } },
    ];
    composed.concepts.material = {
      id: 'material',
      codes: ['MAT001'],
      type: 'resource',
      summary: 'Material',
      unit: 'unit',
      prices: [{ label: 'Venta', amount: { raw: '5' } }],
      dates: [],
      texts: [],
      decomposition: [],
    };
    composed.roots[0]!.children[0]!.children[0]!.children = [
      { id: 'material-node', conceptCode: 'MAT001', children: [], measurements: [] },
    ];
    composed.roots[0]!.children[0]!.children[1]!.children = [
      { id: 'material-node-2', conceptCode: 'MAT001', children: [], measurements: [] },
    ];

    const result = calculateConstructionDocument(composed);
    expect(result.total).toBe(145);
    expect(result.tree[0]?.children[0]?.children[0]?.unitPrice).toBe(10);
  });

  it('does not report a plausible total when a referenced concept is missing', () => {
    const invalid = structuredClone(document);
    invalid.roots[0]!.conceptCode = 'MISSING';

    const result = calculateConstructionDocument(invalid);
    expect(result.valid).toBe(false);
    expect(result.total).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
