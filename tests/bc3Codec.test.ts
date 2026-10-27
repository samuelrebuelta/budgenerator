import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBc3, serializeBc3 } from '@/shared/lib/bc3';

const readFixture = (name: string) =>
  new Uint8Array(Buffer.from(readFileSync(`tests/fixtures/bc3/${name}`, 'utf8'), 'latin1'));
const readExample = (name: string) => new Uint8Array(readFileSync(`examples/bc3/${name}`));

describe('BC3 codec', () => {
  it('parses a base catalogue without translating it into legacy catalog models', async () => {
    const result = parseBc3(readFixture('catalog-minimal.bc3'));

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.kind).toBe('catalog');
    expect(result.document?.concepts).toHaveProperty('concept_PAV001');
    expect(result.document?.concepts.concept_PAV001?.decomposition).toHaveLength(2);
    expect(result.document?.opaqueRecords[0]?.raw).toBe('~X|PAV001|custom\\value|');
    expect(result.document?.header).toMatchObject({
      owner: 'BudGenerator fixtures',
      program: 'BudGenerator',
      title: 'Catálogo sintético',
      comment: 'Base de prueba',
      informationType: 1,
    });
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
    expect(
      Object.values(budget.document?.roots[0]?.children[0]?.measurements[0] ?? {}).some(
        (value) => value === undefined,
      ),
    ).toBe(false);
    expect(certification.document).toBeNull();
    expect(certification.diagnostics[0]?.code).toBe('unsupported-information-type');
    expect(parseBc3(new TextEncoder().encode('~V|x|3/2024|x|x|ANSI|x|4|')).document).toBeNull();
  });

  it('parses the downloadable Spanish catalog and budget examples', () => {
    const catalog = parseBc3(readExample('catalogo-reforma-bano.bc3'));
    const budget = parseBc3(readExample('presupuesto-reforma-bano.bc3'));

    expect(catalog.diagnostics).toEqual([]);
    expect(catalog.document?.kind).toBe('catalog');
    expect(catalog.document?.header.title).toBe('Catálogo de reforma de baño');
    expect(catalog.document?.concepts.concept_ALI001?.decomposition).toHaveLength(3);
    expect(budget.diagnostics).toEqual([]);
    expect(budget.document?.kind).toBe('budget');
    expect(budget.document?.header.title).toBe('Presupuesto de reforma de baño');
    expect(budget.document?.roots[0]?.children).toHaveLength(2);
    expect(budget.document?.roots[0]?.children[1]?.children[1]?.measurements[0]?.total?.raw).toBe(
      '8.50',
    );
  });

  it('preserves concept synonyms, multiple price labels, dates and multiline text', () => {
    const input = Buffer.from(
      '~V|Owner|3/2024|Program|Base\\Venta\\Coste|ANSI|Comentario|1|\r\n' +
        '~C|A001\\A-ALIAS|ud|Partida|10.50\\8.25|01012024\\02012024|3|\r\n' +
        '~T|A001|Texto uno\r\nTexto dos|\r\n\u001a',
      'latin1',
    );
    const result = parseBc3(new Uint8Array(input));
    const concept = Object.values(result.document?.concepts ?? {})[0];

    expect(result.diagnostics).toEqual([]);
    expect(concept?.codes).toEqual(['A001', 'A-ALIAS']);
    expect(concept?.prices.map((price) => [price.label, price.amount.raw])).toEqual([
      ['Venta', '10.50'],
      ['Coste', '8.25'],
    ]);
    expect(concept?.dates).toEqual(['01012024', '02012024']);
    expect(concept?.texts).toEqual(['Texto uno\r\nTexto dos']);
  });

  it('blocks a budget with an unsupported record that can change its structure', async () => {
    const input = new TextEncoder().encode(
      '~V|Owner|3/2024|Program|Obra|ANSI|Budget|2|\r\n' +
        '~C|##ROOT||Obra|10| |0|\r\n' +
        '~Y|##ROOT|PAV001\\1\\1|\r\n\u001a',
    );
    const result = parseBc3(input);

    expect(result.document).toBeNull();
    expect(result.diagnostics.some((item) => item.code === 'unsupported-record')).toBe(true);
  });

  it('serializes and parses the canonical graph while retaining raw decimal lexemes', async () => {
    const source = parseBc3(readFixture('catalog-minimal.bc3')).document;
    expect(source).not.toBeNull();
    const result = parseBc3(serializeBc3(source!));

    expect(result.document?.concepts.concept_PAV001?.prices[0]?.amount.raw).toBe('20.00');
    expect(result.document?.concepts.concept_PAV001?.decomposition).toHaveLength(2);
  });
});
