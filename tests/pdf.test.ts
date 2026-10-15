import { mkdirSync, writeFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { buildBudgetDocument } from '../src/shared/lib/pdf';
import { toPublicBudget } from '../src/entities/budget/model/publicBudget';
import { budget } from './fixtures';
it('renders long concepts over multiple pages, with consistent public amounts', () => {
  const b = budget();
  b.workItems[0]!.tasks = Array.from({ length: 32 }, (_, i) => ({
    ...b.workItems[0]!.tasks[0]!,
    id: String(i),
    description: 'Descripción extensa de un trabajo de preparación, protección y acabado. '.repeat(
      12,
    ),
  }));
  const doc = buildBudgetDocument(b, {
    name: 'Estudio Roble',
    cif: '',
    address: '',
    phone: '',
    email: '',
  });
  if (process.env.CIMBRA_PDF_QA === '1') {
    mkdirSync('tmp/pdfs', { recursive: true });
    writeFileSync('tmp/pdfs/long-budget.pdf', Buffer.from(doc.output('arraybuffer')));
  }
  expect(doc.getNumberOfPages()).toBeGreaterThan(3);
  const publicDoc = buildBudgetDocument(toPublicBudget(b));
  expect(publicDoc.output('arraybuffer').byteLength).toBeGreaterThan(10000);
});
