import { describe, expect, it } from 'vitest';
import {
  validateConstructionDocument,
  type ConstructionDocument,
} from '@/entities/construction-document/model';

function makeDocument(): ConstructionDocument {
  return {
    id: 'budget-1',
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
      root: {
        id: 'root',
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
        decomposition: [
          { code: 'PAV001', factor: { raw: '1' }, yield: { raw: '12.00' } },
          { code: 'PAV001', factor: { raw: '1' }, yield: { raw: '2,50' } },
        ],
      },
      paving: {
        id: 'paving',
        codes: ['PAV001', 'PAV-AUX'],
        type: 'work-unit',
        summary: 'Colocación',
        unit: 'm2',
        prices: [{ label: 'Venta', amount: { raw: '42,7500' } }],
        dates: ['25102026'],
        texts: ['Texto largo'],
        decomposition: [],
      },
    },
    roots: [
      {
        id: 'root-node',
        conceptCode: '##WORK',
        children: [
          {
            id: 'chapter-node',
            conceptCode: '#01',
            children: [
              {
                id: 'paving-node-1',
                conceptCode: 'PAV001',
                children: [],
                measurements: [
                  {
                    total: { raw: '12.00' },
                    units: { raw: '1' },
                    length: { raw: '3' },
                    breadth: { raw: '4' },
                  },
                ],
              },
              {
                id: 'paving-node-2',
                conceptCode: 'PAV001',
                children: [],
                measurements: [{ total: { raw: '2,50' }, expression: '(a*b)' }],
              },
            ],
            measurements: [],
          },
        ],
        measurements: [],
      },
    ],
    coefficients: [{ code: 'DD', value: 2 }],
    opaqueRecords: [
      { type: '~X', raw: '~X|PAV001|custom\\value|', order: 8, referencedCodes: ['PAV001'] },
    ],
    business: { ivaRate: { raw: '0.10' }, clientName: 'Cliente' },
  };
}

describe('ConstructionDocument invariants', () => {
  it('allows the same concept in multiple ordered budget occurrences', () => {
    const document = makeDocument();

    expect(validateConstructionDocument(document)).toEqual([]);
    expect(document.roots[0]?.children[0]?.children.map((node) => node.id)).toEqual([
      'paving-node-1',
      'paving-node-2',
    ]);
  });

  it('rejects a BC3 code assigned to two distinct concepts', () => {
    const document = makeDocument();
    document.concepts.other = {
      ...document.concepts.paving!,
      id: 'other',
      codes: ['PAV001'],
    };

    expect(validateConstructionDocument(document).map((issue) => issue.code)).toContain(
      'duplicate-concept-code',
    );
  });

  it('reports dangling decomposition and occurrence references', () => {
    const document = makeDocument();
    document.concepts.chapter!.decomposition[0]!.code = 'MISSING';
    document.roots[0]!.children[0]!.children[0]!.conceptCode = 'MISSING';

    expect(validateConstructionDocument(document).map((issue) => issue.code)).toContain(
      'unknown-concept-reference',
    );
  });

  it('detects recursive concept decompositions', () => {
    const document = makeDocument();
    document.concepts.paving!.decomposition = [
      { code: '##WORK', factor: { raw: '1' }, yield: { raw: '1' } },
    ];

    expect(validateConstructionDocument(document).map((issue) => issue.code)).toContain(
      'cyclic-decomposition',
    );
  });

  it('keeps decimal lexemes and opaque records intact for round-trip writing', () => {
    const document = makeDocument();

    expect(document.concepts.paving?.prices[0]?.amount.raw).toBe('42,7500');
    expect(document.roots[0]?.children[0]?.children[1]?.measurements[0]?.total.raw).toBe('2,50');
    expect(document.opaqueRecords[0]).toEqual({
      type: '~X',
      raw: '~X|PAV001|custom\\value|',
      order: 8,
      referencedCodes: ['PAV001'],
    });
  });
});
