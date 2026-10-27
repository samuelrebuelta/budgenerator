import { describe, expect, it } from 'vitest';
import {
  updateConstructionConcept,
  updateConstructionMeasurementFactor,
  updateConstructionNodeMeasurements,
} from '@/entities/construction-document/model/editor';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import { calculateConstructionDocument } from '@/entities/construction-document/model/math';

function documentFixture(): ConstructionDocument {
  const concept = {
    id: 'item',
    codes: ['ITEM001'],
    type: 'work-unit',
    summary: 'Alicatado',
    unit: 'm2',
    prices: [{ label: 'Venta', amount: { raw: '42.00' } }],
    dates: [],
    texts: [],
    decomposition: [],
  };
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
    concepts: { item: concept },
    roots: [
      {
        id: 'chapter',
        conceptCode: 'ITEM001',
        measurements: [],
        children: [
          { id: 'occurrence-1', conceptCode: 'ITEM001', measurements: [], children: [] },
          { id: 'occurrence-2', conceptCode: 'ITEM001', measurements: [], children: [] },
        ],
      },
    ],
    coefficients: [],
    opaqueRecords: [
      { type: '~X', raw: '~X|ITEM001|keep|', order: 0, referencedCodes: ['ITEM001'] },
    ],
    business: {},
  };
}

describe('ConstructionDocument editor', () => {
  it('edits a concept by its FIEBDC code without rebuilding or flattening the graph', () => {
    const source = documentFixture();
    const edited = updateConstructionConcept(source, 'ITEM001', {
      summary: 'Alicatado cerámico',
      unit: 'm²',
      prices: [{ label: 'Venta', amount: { raw: '48.50' } }],
    });

    expect(edited.concepts.item?.summary).toBe('Alicatado cerámico');
    expect(edited.concepts.item?.prices[0]?.amount.raw).toBe('48.50');
    expect(edited.roots).toEqual(source.roots);
    expect(edited.opaqueRecords).toEqual(source.opaqueRecords);
    expect(source.concepts.item?.summary).toBe('Alicatado');
  });

  it('edits measurement data on one occurrence and leaves reused nodes intact', () => {
    const source = documentFixture();
    const edited = updateConstructionNodeMeasurements(source, 'occurrence-1', [
      {
        total: { raw: '8.25' },
        units: { raw: '1' },
        length: { raw: '3.3' },
        breadth: { raw: '2.5' },
      },
    ]);

    expect(edited.roots[0]?.children[0]?.measurements[0]?.total?.raw).toBe('8.25');
    expect(edited.roots[0]?.children[1]?.measurements).toEqual([]);
    expect(source.roots[0]?.children[0]?.measurements).toEqual([]);
  });

  it('clears a stale total when changing a dimensional factor', () => {
    const source = documentFixture();
    const withMeasurement = updateConstructionNodeMeasurements(source, 'occurrence-1', [
      {
        total: { raw: '12' },
        units: { raw: '1' },
        length: { raw: '3' },
        breadth: { raw: '4' },
        comment: 'Pared del baño',
      },
    ]);

    const edited = updateConstructionMeasurementFactor(
      withMeasurement,
      'occurrence-1',
      0,
      'length',
      '3.5',
    );
    const measurement = edited.roots[0]?.children[0]?.measurements[0];

    expect(measurement?.total).toBeUndefined();
    expect(measurement?.length?.raw).toBe('3.5');
    expect(measurement?.breadth?.raw).toBe('4');
    expect(measurement?.comment).toBe('Pared del baño');
    expect(calculateConstructionDocument(edited).tree[0]?.children[0]?.quantity).toBe(14);
  });
});
