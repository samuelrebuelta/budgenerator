import { expect, it } from 'vitest';
import { BASE_CATALOGS, TRADE_CATALOGS } from '../src/catalog/baseCatalogs';
import { baseCatalogDocument } from '../src/catalog/bases';
import {
  addCatalogConcept,
  addChapter,
  createEmptyDocument,
  mergeIntoCatalog,
  normalizeText,
  projectCatalogParts,
} from '../src/construction-document/index';

it('offers specialized and complete renovation catalogs as import sources', () => {
  expect(TRADE_CATALOGS.map((catalog) => catalog.id)).toEqual([
    'banos_aseos',
    'cocinas',
    'fachadas_cubiertas',
    'eficiencia_energetica',
    'exteriores_jardines',
    'piscinas',
    'accesibilidad',
    'locales_comerciales',
    'garajes_sotanos',
    'reforma_integral',
  ]);
  expect(BASE_CATALOGS.map((catalog) => catalog.id)).toEqual(['en_blanco', 'reforma_integral']);
});

it('provides the complete catalog with alphabetized, concise work categories', () => {
  const general = BASE_CATALOGS.find((catalog) => catalog.id === 'reforma_integral');
  const families = [
    'Accesibilidad',
    'Aislamiento',
    'Albañilería',
    'Carpintería',
    'Cerrajería',
    'Cimentación',
    'Climatización',
    'Cocinas',
    'Cubiertas',
    'Demolición',
    'Electricidad',
    'Energía solar',
    'Enlucidos',
    'Estructura',
    'Exteriores',
    'Fachadas',
    'Fontanería',
    'Gas',
    'Jardinería',
    'Limpieza',
    'Mudanzas',
    'Pavimentos',
    'Pintura',
    'Piscinas',
    'Pladur',
    'Revestimientos',
    'Telecomunicaciones',
    'Varios',
    'Ventanas',
    'Vidrio',
  ];

  expect(general).toBeDefined();
  expect(TRADE_CATALOGS).toContain(general);
  expect([...new Set(general?.tariffs.map((tariff) => tariff.category))]).toEqual(families);
  expect(
    general?.tariffs.filter((tariff) => tariff.category === 'Electricidad').length,
  ).toBeGreaterThan(1);
  expect(general?.tariffs.every((tariff) => tariff.basePrice === 0 && tariff.cost === 0)).toBe(
    true,
  );
});

it('imports the complete catalog idempotently without replacing private prices', () => {
  const general = BASE_CATALOGS.find((catalog) => catalog.id === 'reforma_integral')!;
  const source = baseCatalogDocument(general);
  const electrical = general.tariffs.find((tariff) => tariff.category === 'Electricidad')!;
  let target = createEmptyDocument('catalog');
  const chapter = addChapter(target, 'Electricidad');
  target = addCatalogConcept(chapter.document, chapter.chapterId, {
    description: electrical.description.toUpperCase(),
    unit: electrical.unit === 'unit' ? 'ud' : electrical.unit,
    price: 99,
    cost: 50,
  }).document;
  const first = mergeIntoCatalog(target, source);
  const second = mergeIntoCatalog(first.document, source);
  expect(first.addedConcepts).toBe(general.tariffs.length - 1);
  expect(second).toMatchObject({ addedParts: 0, addedConcepts: 0 });
  const kept = projectCatalogParts(second.document)
    .find((part) => part.name === 'Electricidad')!
    .concepts.find(
      (concept) => normalizeText(concept.description) === normalizeText(electrical.description),
    );
  expect(kept).toMatchObject({ basePrice: 99, cost: 50 });
});

it('imports a single chapter or a single concept when asked', () => {
  const trade = TRADE_CATALOGS.find((catalog) => catalog.id === 'cocinas')!;
  const source = baseCatalogDocument(trade);
  const chapterName = trade.tariffs[0]!.category;
  const onlyChapter = mergeIntoCatalog(
    createEmptyDocument('catalog'),
    source,
    (chapter) => normalizeText(chapter) === normalizeText(chapterName),
  );
  expect(projectCatalogParts(onlyChapter.document).map((part) => part.name)).toEqual([chapterName]);
  const concept = trade.tariffs[0]!;
  const onlyConcept = mergeIntoCatalog(
    createEmptyDocument('catalog'),
    source,
    (chapter, item) =>
      normalizeText(chapter) === normalizeText(chapterName) &&
      (!item || normalizeText(item.summary) === normalizeText(concept.description)),
  );
  expect(onlyConcept.addedConcepts).toBe(1);
});
