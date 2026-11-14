/**
 * Long budget of the PDF reference test, shared with the mobile PDF spike (BG-014 phase 0) so both
 * engines render exactly the same input.
 */
import type { Budget, CompanyProfile } from '../src/types/index';
import { budget } from './fixtures';

export function longBudgetPdfInput(): { budget: Budget; company: CompanyProfile } {
  const b = budget();
  b.workItems[0]!.tasks = Array.from({ length: 32 }, (_, i) => ({
    ...b.workItems[0]!.tasks[0]!,
    id: String(i),
    description: 'Descripción extensa de un trabajo de preparación, protección y acabado. '.repeat(
      12,
    ),
  }));
  return {
    budget: b,
    company: { name: 'Estudio Roble', cif: '', address: '', phone: '', email: '' },
  };
}
