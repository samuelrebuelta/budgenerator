/**
 * BG-014 criterion «mismos importes en web y móvil»: the amounts the mobile screens show
 * (`recordTotals`, `chapterAmount`, `itemAmount`, list totals) equal the ones the web shows for the
 * same canonical documents — the editor (`documentTotals`, the store's `getTotal`), the public
 * viewer (`budgetTotals` over `sharedBudgetView`) and the PDF — and they print the same text.
 */
import { budgetTotals, formatEuros } from '@bg/domain';
import { buildSharedBudget, sharedBudgetView } from '@bg/domain/budget/publicBudget';
import { budgetView, type BudgetRecord } from '@bg/domain/budget/record';
import {
  addChapter,
  addItem,
  createEmptyDocument,
  documentTotals,
  setMeasurementLines,
  updateBusiness,
  type ConstructionDocument,
} from '@bg/domain/construction-document';
import {
  chapterAmount,
  filterBudgets,
  itemAmount,
  recordTotals,
} from '../src/features/budgets/model';
// Same fixtures as the domain and web tests.
import { budgetRecord, sampleDocument } from '../../../packages/domain/tests/fixtures';

const company = { name: 'Estudio Roble', cif: '', address: '', phone: '', email: '' };

function record(id: string, document: ConstructionDocument): BudgetRecord {
  return { ...budgetRecord(id), document };
}

/** Two chapters (one nested), awkward decimals, amounts from 1.000 to 9.999 € and a measured line. */
function richDocument(): ConstructionDocument {
  let document = createEmptyDocument('budget', {
    clientName: 'Comunidad Olmo',
    address: 'Calle Mayor 3',
    date: '2026-11-14',
    budgetNumber: '42',
  });
  const walls = addChapter(document, 'Albañilería');
  document = addItem(walls.document, walls.chapterId, {
    description: 'Tabique de ladrillo',
    quantity: 8.5,
    unit: 'm2',
    price: 9.79,
    cost: 6.1,
  }).document;
  document = addItem(document, walls.chapterId, {
    description: 'Solera',
    quantity: 37.25,
    unit: 'm2',
    price: 33.17,
  }).document;
  const nested = addChapter(document, 'Remates', { parentId: walls.chapterId });
  const measured = addItem(nested.document, nested.chapterId, {
    description: 'Rodapié',
    unit: 'ml',
    price: 12.4,
  });
  document = setMeasurementLines(measured.document, measured.nodeId, [
    { type: '', comment: 'Salón', units: '2', length: '4.35' },
    { type: '', comment: 'Pasillo', units: '1', length: '7.1' },
  ]);
  const paint = addChapter(document, 'Pintura');
  return addItem(paint.document, paint.chapterId, {
    description: 'Pintura plástica',
    quantity: 212,
    unit: 'm2',
    price: 7.35,
    cost: 3.2,
  }).document;
}

const cases: [string, BudgetRecord][] = [
  ['ejemplo de los tests del dominio', budgetRecord('sample')],
  ['documento con capítulos anidados y mediciones', record('rich', richDocument())],
  [
    'descuento del 12,5 %',
    record(
      'discount',
      updateBusiness(richDocument(), { adjustment: { multiplier: 0.875, reason: 'Amistad' } }),
    ),
  ],
  [
    'recargo del 15 % e IVA del 21 %',
    record(
      'surcharge',
      updateBusiness(richDocument(), {
        ivaRate: 0.21,
        adjustment: { multiplier: 1.15, reason: 'Distancia' },
      }),
    ),
  ],
  ['IVA del 0 %', record('no-vat', updateBusiness(sampleDocument(), { ivaRate: 0 }))],
];

describe('paridad de importes web/móvil (@bg/domain)', () => {
  it.each(cases)('%s: totales del móvil = editor web = visor público', (_name, item) => {
    const mobile = recordTotals(item);
    const editor = documentTotals(item.document);
    expect(mobile.raw).toBe(editor.raw);
    expect(mobile.subtotal).toBe(editor.subtotal);
    expect(mobile.iva).toBe(editor.iva);
    expect(mobile.total).toBe(editor.total);
    expect(formatEuros(mobile.total)).toBe(formatEuros(editor.total));

    const publicView = sharedBudgetView(buildSharedBudget(item, company, 'owner'));
    expect(budgetTotals(publicView).total).toBe(mobile.total);

    const [listed] = filterBudgets([item], '', '');
    expect(listed!.total).toBe(editor.total);
  });

  it.each(cases)('%s: cada partida y capítulo = nodos del editor web', (_name, item) => {
    const view = budgetView(item);
    const nodes = documentTotals(item.document).nodes;
    for (const chapter of view.workItems) {
      expect(chapterAmount(view, chapter.id)).toBe(nodes.get(chapter.id)?.amount ?? 0);
      for (const task of chapter.tasks)
        expect(itemAmount(view, task)).toBe(nodes.get(task.id)?.amount);
    }
  });

  it('imprime los importes de 1.000 a 9.999 € igual que la web y el PDF de referencia', () => {
    expect(formatEuros(1234.5)).toBe('1234,50\u00a0€');
    expect(formatEuros(12345.5)).toBe('12.345,50\u00a0€');
    const total = recordTotals(record('rich', richDocument())).total;
    expect(total).toBeGreaterThan(1000);
    expect(formatEuros(total)).toMatch(/^\d{4},\d{2}\u00a0€$/);
  });
});
