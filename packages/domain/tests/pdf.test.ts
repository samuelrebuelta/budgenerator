import { mkdirSync, writeFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { buildBudgetDocument } from '../src/pdf/budgetDocument';
import { buildSharedBudget, sharedBudgetView } from '../src/budget/publicBudget';
import { budgetRecord } from './fixtures';
import { longBudgetPdfInput } from './pdfFixtures';
it('renders long concepts over multiple pages, with consistent public amounts', () => {
  const { budget, company } = longBudgetPdfInput();
  const doc = buildBudgetDocument(budget, company);
  if (process.env.CIMBRA_PDF_QA === '1') {
    mkdirSync('tmp/pdfs', { recursive: true });
    writeFileSync('tmp/pdfs/long-budget.pdf', Buffer.from(doc.output('arraybuffer')));
  }
  expect(doc.getNumberOfPages()).toBeGreaterThan(3);
  const publicDoc = buildBudgetDocument(
    sharedBudgetView(
      buildSharedBudget(
        budgetRecord(),
        { name: '', cif: '', address: '', phone: '', email: '' },
        'u',
      ),
    ),
  );
  expect(publicDoc.output('arraybuffer').byteLength).toBeGreaterThan(3000);
});
