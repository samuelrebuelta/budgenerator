import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBc3, serializeBc3 } from '@/entities/construction-document/bc3';
import {
  calculateConstructionTotals,
  projectCatalogParts,
  projectWorkItems,
  type ConstructionDocument,
} from '@/entities/construction-document/model';
import { decodeBytes, encodeWindows1252 } from '@/shared/lib/charset';

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/bc3/${name}`));
const ansi = (text: string) => encodeWindows1252(text).bytes;
const errors = (result: ReturnType<typeof parseBc3>) =>
  result.diagnostics.filter((item) => item.severity === 'error');
const codes = (result: ReturnType<typeof parseBc3>) => result.diagnostics.map((item) => item.code);

function minimalWork(body: string[], header = '~V|X|FIEBDC-3/2020|P|Obra|ANSI||2|') {
  return ansi([header, ...body].join('\r\n') + '\r\n\u001a');
}

function reimport(document: ConstructionDocument, target: 'catalog' | 'budget' | 'template') {
  const exported = serializeBc3(document, { now: new Date(2026, 1, 1) });
  const again = parseBc3(exported.bytes, { target, today: '2026-02-01' });
  return { exported, again };
}

describe('charset tables', () => {
  it('maps every high byte of the DOS code pages', () => {
    const bytes = Uint8Array.from({ length: 128 }, (_, index) => index + 128);
    expect([...decodeBytes(bytes, '850')]).toHaveLength(128);
    expect([...decodeBytes(bytes, '437')]).toHaveLength(128);
    expect(decodeBytes(Uint8Array.from([0xa4, 0xa5, 0x82, 0xfd, 0xa7]), '850')).toBe('ñÑé²º');
    expect(decodeBytes(Uint8Array.from([0xa4, 0xa0, 0xe1]), '437')).toBe('ñáß');
    expect(decodeBytes(Uint8Array.from([0xb5, 0xd6, 0xe0]), '850')).toBe('ÁÍÓ');
  });

  it('reports characters that ANSI cannot represent', () => {
    const { bytes, replaced } = encodeWindows1252('m² € — ≥ 漢');
    expect(replaced).toEqual(['≥', '漢']);
    expect(decodeBytes(bytes, 'ANSI')).toBe('m² € — ? ?');
  });
});

describe('price base import (ANSI)', () => {
  const result = parseBc3(fixture('base-precios-ansi.bc3'), { target: 'catalog' });
  const document = result.document!;

  it('reads header, prices, synonyms, texts and extensions', () => {
    expect(errors(result)).toEqual([]);
    expect(codes(result)).toEqual(
      expect.arrayContaining(['multiple-prices', 'extension-records']),
    );
    expect(document.kind).toBe('catalog');
    expect(document.header).toMatchObject({
      version: 'FIEBDC-3/2020',
      versionDate: '15012026',
      priceLabels: ['VENTA', 'COSTE'],
      charset: 'ANSI',
    });
    const labour = Object.values(document.concepts).find((concept) => concept.code === 'MO001')!;
    expect(labour).toMatchObject({ synonyms: ['OF1'], unit: 'h', prices: ['22.00', '20.00'] });
    const tile = Object.values(document.concepts).find((concept) => concept.code === 'MT001')!;
    expect(tile.summary).toBe('Azulejo cerámico 30×60 cm «blanco»');
    expect(tile.unit).toBe('m²');
    const wall = Object.values(document.concepts).find((concept) => concept.code === 'E02ALI')!;
    expect(wall.text).toBe(
      'Alicatado con azulejo cerámico, recibido con adhesivo.\nIncluye rejuntado y limpieza.',
    );
    expect(document.extensions).toEqual([{ type: '~X', raw: '~X|E02ALI|PESO\\12.5\\|' }]);
  });

  it('builds chapters, keeps decompositions and computes percentage lines', () => {
    const parts = projectCatalogParts(document);
    expect(parts.map((part) => part.name)).toEqual([
      'Partidas sin capítulo',
      'Albañilería',
      'Revestimientos y acabados',
    ]);
    const masonry = parts[1]!.concepts;
    expect(masonry.map((item) => [item.code, item.basePrice, item.composed])).toEqual([
      ['E01DEM', 9.79, true],
      ['E03TAB', 31.4, false],
    ]);
    expect(parts[2]!.concepts.find((item) => item.code === 'E02ALI')!.basePrice).toBe(39.07);
    expect(result.summary).toMatchObject({ chapters: 2, items: 5, composedConcepts: 2 });
  });

  it('round-trips export → import keeping codes, order, prices and extensions', () => {
    const { exported, again } = reimport(document, 'catalog');
    expect(errors(again)).toEqual([]);
    const text = decodeBytes(exported.bytes, 'ANSI');
    expect(text.endsWith('\r\n\u001a')).toBe(true);
    expect(text).toContain('~C|MO001\\OF1|h|Oficial 1ª|22.00\\20.00\\|01012026\\|1|');
    expect(text).toContain('~D|E01DEM||MO002\\1\\0.40\\\\MO001\\1\\0.10\\\\%MA\\1\\1\\MO\\|');
    expect(text).toContain('~X|E02ALI|PESO\\12.5\\|');
    const strip = (doc: ConstructionDocument) =>
      Object.values(doc.concepts).map((concept) => [
        concept.code,
        concept.unit,
        concept.summary,
        concept.decomposition.length,
        concept.text ?? '',
      ]);
    expect(strip(again.document!)).toEqual(strip(document));
    expect(projectCatalogParts(again.document!)).toEqual(projectCatalogParts(document));
    expect(again.document!.extensions).toEqual(document.extensions);
  });
});

describe('work import (code page 850)', () => {
  const result = parseBc3(fixture('obra-mediciones-850.bc3'), {
    target: 'budget',
    today: '2026-02-01',
  });
  const document = result.document!;

  it('decodes 850 text and accepts the file with explicit warnings', () => {
    expect(errors(result)).toEqual([]);
    expect(codes(result)).toEqual(
      expect.arrayContaining(['global-percentages', 'extension-records']),
    );
    expect(document.kind).toBe('budget');
    expect(document.business).toMatchObject({ address: 'Reforma de vivienda', ivaRate: 0.21 });
    const waste = Object.values(document.concepts).find((concept) => concept.code === 'E03GES')!;
    expect(waste.summary).toBe('Gestión de residuos (contenedor 5 m³)');
  });

  it('keeps nested chapters, root items and measurement lines; totals match to the cent', () => {
    const workItems = projectWorkItems(document);
    expect(workItems.map((item) => [item.name, item.depth, item.tasks.length])).toEqual([
      ['Partidas sin capítulo', 0, 1],
      ['Demoliciones', 0, 0],
      ['Baño principal', 1, 1],
      ['Revestimientos', 0, 2],
    ]);
    const bath = workItems[2]!.tasks[0]!;
    expect(bath).toMatchObject({ quantity: 8.5, price: 9.79, measured: true, composed: true });
    const walls = workItems[3]!.tasks[0]!;
    expect(walls).toMatchObject({ quantity: 12.3, price: 39.07, measured: true });
    expect(workItems[3]!.tasks[1]).toMatchObject({ quantity: 2, measured: false, shared: true });
    const totals = calculateConstructionTotals(document);
    expect(totals.raw).toBe(651.36);
    expect(result.summary).toMatchObject({ declaredTotal: 651.36, computedTotal: 651.36 });
    expect(totals.iva).toBe(136.79);
    expect(totals.total).toBe(788.15);
  });

  it('round-trips export → import with the same structure, measurements and total', () => {
    const { exported, again } = reimport(document, 'budget');
    expect(errors(again)).toEqual([]);
    const text = decodeBytes(exported.bytes, 'ANSI');
    expect(text).toContain('~K|\\2\\2\\3\\2\\2\\2\\2\\EUR\\|0\\13\\6\\0\\21\\|');
    expect(text).toContain('~C|OBRA##||Reforma de vivienda|651.36\\||0|');
    expect(text).toContain('~M|02#\\E02ALI|2\\1\\|12.3|3\\a*b*d\\2\\2.5\\\\2.46\\||');
    expect(projectWorkItems(again.document!)).toEqual(projectWorkItems(document));
    expect(calculateConstructionTotals(again.document!).raw).toBe(651.36);
    const third = reimport(again.document!, 'budget');
    expect(third.exported.bytes).toEqual(exported.bytes);
  });

  it('imports the same work as a template', () => {
    const template = parseBc3(fixture('obra-mediciones-850.bc3'), { target: 'template' });
    expect(template.document?.kind).toBe('template');
  });
});

describe('rejections and diagnostics', () => {
  it('rejects certifications and database updates', () => {
    const cert = parseBc3(fixture('certificacion.bc3'), { target: 'budget' });
    expect(cert.document).toBeNull();
    expect(errors(cert)[0]).toMatchObject({ code: 'unsupported-information-type' });
    const update = parseBc3(ansi('~V|X|FIEBDC-3/2020|P|T|ANSI||4|\r\n'), { target: 'catalog' });
    expect(errors(update)[0]!.message).toContain('actualización');
  });

  it('rejects empty, truncated, headerless and unknown charset files', () => {
    expect(errors(parseBc3(new Uint8Array(), { target: 'catalog' }))[0]!.code).toBe('empty-file');
    const bytes = fixture('obra-mediciones-850.bc3');
    const truncated = parseBc3(bytes.subarray(0, 700), { target: 'budget' });
    expect(truncated.document).toBeNull();
    expect(codes(truncated)).toContain('truncated-file');
    expect(codes(parseBc3(ansi('~C|A||x|1||0|\r\n'), { target: 'catalog' }))).toContain(
      'missing-header',
    );
    expect(
      codes(parseBc3(ansi('~V|X|FIEBDC-3/2020|P|T|KOI8|x|1|\r\n'), { target: 'catalog' })),
    ).toContain('unsupported-character-set');
  });

  it('refuses a price base as a budget', () => {
    const result = parseBc3(fixture('base-precios-ansi.bc3'), { target: 'budget' });
    expect(errors(result)[0]!.code).toBe('kind-mismatch');
  });

  it('blocks a work whose declared total does not match', () => {
    const bytes = minimalWork([
      '~C|R##||Obra|100.00||0|',
      '~C|C1#||Cap|||0|',
      '~C|P1|m2|Partida|10.00||0|',
      '~D|R##|C1#\\1\\1\\|',
      '~D|C1#|P1\\1\\3\\|',
    ]);
    const result = parseBc3(bytes, { target: 'budget' });
    expect(result.document).toBeNull();
    expect(codes(result)).toContain('total-mismatch');
    expect(result.summary).toMatchObject({ declaredTotal: 100, computedTotal: 30 });
  });

  it('blocks unknown references, invalid numbers, duplicates and structural records', () => {
    const result = parseBc3(
      minimalWork([
        '~C|R##||Obra|||0|',
        '~C|C1#||Cap|||0|',
        '~C|C1#||Repetido|||0|',
        '~C|P1|m2|Partida|abc||0|',
        '~D|R##|C1#\\1\\1\\|',
        '~D|C1#|P1\\1\\2\\FALTA\\1\\1\\|',
        '~B|P1|P2|',
      ]),
      { target: 'budget' },
    );
    expect(result.document).toBeNull();
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'duplicate-concept',
        'invalid-number',
        'unknown-concept-reference',
        'unsupported-record',
      ]),
    );
  });

  it('blocks measurements whose lines do not add up to the declared total', () => {
    const result = parseBc3(
      minimalWork([
        '~C|R##||Obra|||0|',
        '~C|C1#||Cap|||0|',
        '~C|P1|m2|Partida|10||0|',
        '~D|R##|C1#\\1\\1\\|',
        '~D|C1#|P1\\1\\6\\|',
        '~M|C1#\\P1|1\\1\\|6|\\a\\2\\3\\\\\\\\b\\2\\\\\\\\|',
      ]),
      { target: 'budget' },
    );
    expect(codes(result)).toContain('measurement-mismatch');
    expect(result.document).toBeNull();
  });

  it('blocks chapters multiplied by a yield', () => {
    const result = parseBc3(
      minimalWork([
        '~C|R##||Obra|||0|',
        '~C|C1#||Cap|||0|',
        '~C|P1|m2|Partida|10||0|',
        '~D|R##|C1#\\1\\2\\|',
        '~D|C1#|P1\\1\\1\\|',
      ]),
      { target: 'budget' },
    );
    expect(codes(result)).toContain('invalid-structure');
  });

  it('accepts UTF-8 with BOM, 437 text and records split over CRLF lines', () => {
    const body = '~V|X|FIEBDC-3/2020|P|Año|UTF-8||1|\r\n~C|A|ud|Caña|1.5||0|\r\n';
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(body)]);
    const utf = parseBc3(bom, { target: 'catalog' });
    expect(errors(utf)).toEqual([]);
    expect(utf.document!.header.title).toBe('Año');
    const dos = new Uint8Array([
      ...ansi('~V|X|FIEBDC-3/98|P|Ba'),
      0xa4,
      ...ansi('o|437||1|\r\n~C|A|ud|Peque'),
      0xa4,
      ...ansi('o\r\n tabique|2||0|\r\n\u001agarbage'),
    ]);
    const parsed = parseBc3(dos, { target: 'catalog' });
    expect(errors(parsed)).toEqual([]);
    expect(parsed.document!.header.title).toBe('Baño');
    expect(Object.values(parsed.document!.concepts).map((concept) => concept.summary)).toContain(
      'Pequeño tabique',
    );
  });
});

describe('export of app documents', () => {
  it('sanitizes reserved characters and warns about non-FIEBDC data', () => {
    const result = parseBc3(fixture('obra-mediciones-850.bc3'), { target: 'budget' });
    const document = result.document!;
    const concept = Object.values(document.concepts).find((item) => item.code === 'E03GES')!;
    concept.summary = 'Contenedor | 5 m³ ~ grande \\ 漢';
    concept.cost = '50';
    document.business.clientName = 'Ana';
    const { bytes, warnings } = serializeBc3(document);
    expect(warnings.join(' ')).toMatch(/reservados/);
    expect(warnings.join(' ')).toMatch(/cliente/);
    expect(warnings.join(' ')).toMatch(/costes internos/);
    expect(warnings.join(' ')).toMatch(/ANSI/);
    const again = parseBc3(bytes, { target: 'budget' });
    expect(errors(again)).toEqual([]);
    expect(
      Object.values(again.document!.concepts).find((item) => item.code === 'E03GES')!.summary,
    ).toBe('Contenedor / 5 m³ - grande / ?');
    expect(
      Object.values(again.document!.concepts).some((item) => item.cost !== undefined),
    ).toBe(false);
  });
});
