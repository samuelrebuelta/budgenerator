import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBc3, serializeBc3 } from '@/shared/lib/bc3';

const readFixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/bc3/${name}`));

describe('BC3 codec', () => {
  it('parses a base catalogue without translating it into legacy catalog models', async () => {
    const result = parseBc3(readFixture('catalog-minimal.bc3'));

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.kind).toBe('catalog');
    expect(result.document?.concepts).toHaveProperty('concept_PAV001');
    expect(result.document?.concepts.concept_PAV001?.decomposition).toHaveLength(2);
    expect(result.document?.opaqueRecords[0]?.raw).toBe('~X|PAV001|custom\\value|');
  });

  it('parses budget occurrences and rejects certification files explicitly', async () => {
    const budget = parseBc3(readFixture('budget-minimal.bc3'));
    const certification = parseBc3(new TextEncoder().encode('~V|x|3/2024|x|x|ANSI|x|3|'));

    expect(budget.document?.kind).toBe('budget');
    expect(budget.document?.roots[0]?.conceptCode).toBe('##OBRA');
    expect(budget.document?.roots[0]?.children[0]?.measurements[0]?.total?.raw).toBe('1');
    expect(budget.document?.roots[0]?.children[0]?.children[0]?.measurements[0]).toMatchObject({
      total: { raw: '12' },
      units: { raw: '1' },
      length: { raw: '3' },
      breadth: { raw: '4' },
      height: { raw: '1' },
    });
    expect(certification.document).toBeNull();
    expect(certification.diagnostics[0]?.code).toBe('unsupported-information-type');
  });

  it('serializes and parses the canonical graph while retaining raw decimal lexemes', async () => {
    const source = parseBc3(readFixture('catalog-minimal.bc3')).document;
    expect(source).not.toBeNull();
    const result = parseBc3(serializeBc3(source!));

    expect(result.document?.concepts.concept_PAV001?.prices[0]?.amount.raw).toBe('20.00');
    expect(result.document?.concepts.concept_PAV001?.decomposition).toHaveLength(2);
  });
});
