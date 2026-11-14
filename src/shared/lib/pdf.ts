import type { Budget, PublicBudget, CompanyProfile } from '@/shared/types';
import { buildBudgetDocument, type BudgetPdfLogo } from '@bg/domain/pdf/budgetDocument';

export { buildBudgetDocument, type BudgetPdfLogo } from '@bg/domain/pdf/budgetDocument';
interface PdfData {
  budget: Budget | PublicBudget;
  company?: CompanyProfile;
  pdfWindow?: Window | null;
}
async function loadLogo(url: string): Promise<BudgetPdfLogo | null> {
  if (!url.startsWith('data:image/')) return null;
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 4000);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, 1024 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL('image/png'), width: image.width, height: image.height });
      } catch {
        resolve(null);
      } finally {
        clearTimeout(timer);
      }
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}
export async function generateBudgetPdf({ budget, company, pdfWindow }: PdfData) {
  const logo = company?.logo ? await loadLogo(company.logo) : null;
  const doc = buildBudgetDocument(budget, company, logo);
  if (pdfWindow) {
    const url = URL.createObjectURL(doc.output('blob'));
    pdfWindow.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else doc.save(`presupuesto-${budget.info.budgetNumber || 'budgenerator'}.pdf`);
}
