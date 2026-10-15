import { jsPDF } from 'jspdf';
import type { Budget, PublicBudget, CompanyProfile } from '@/shared/types';
import { UNIT_LABELS } from '@/shared/types';
import { assertBudget, budgetTotals, taskAmount, unitPrice, workItemAmount } from './budgetMath';
interface PdfData {
  budget: Budget | PublicBudget;
  company?: CompanyProfile;
  pdfWindow?: Window | null;
}
const fmt = (value: number) =>
  value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
async function loadLogo(
  url: string,
): Promise<{ data: string; width: number; height: number } | null> {
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
/** Shared renderer for private and public documents. All amounts use the same money policy. */
export function buildBudgetDocument(
  budget: Budget | PublicBudget,
  company?: CompanyProfile,
  logo?: { data: string; width: number; height: number } | null,
) {
  assertBudget(budget, true);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18,
    right = 192,
    bottom = 272;
  let y = 22;
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const ink = () => doc.setTextColor(24, 62, 59);
  const muted = () => doc.setTextColor(104, 117, 110);
  const line = () => {
    doc.setDrawColor(226, 227, 216);
    doc.setLineWidth(0.2);
    doc.line(left, y, right, y);
  };
  const newPage = () => {
    doc.addPage();
    y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    ink();
    doc.text(company?.name || 'budgenerator', left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    muted();
    doc.text(`Presupuesto ${budget.info.budgetNumber}`, right, y, { align: 'right' });
    y += 5;
    line();
    y += 10;
  };
  const ensure = (height: number) => {
    if (y + height > bottom) newPage();
  };
  // Restrict the logo to a real box regardless of its aspect ratio.
  let titleLeft = left;
  if (logo) {
    const scale = Math.min(32 / logo.width, 19 / logo.height);
    const w = logo.width * scale,
      h = logo.height * scale;
    doc.addImage(logo.data, 'PNG', left, y - 5, w, h);
    titleLeft += w + 7;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  ink();
  const companyLines = doc.splitTextToSize(company?.name || 'budgenerator', right - titleLeft);
  doc.text(companyLines, titleLeft, y);
  y += Math.max(14, companyLines.length * 7 + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  muted();
  for (const value of [
    company?.cif ? `CIF: ${company.cif}` : '',
    company?.address,
    [company?.phone, company?.email].filter(Boolean).join(' · '),
  ]) {
    if (value) {
      const lines = doc.splitTextToSize(value, right - left);
      ensure(lines.length * 4 + 3);
      doc.text(lines, left, y);
      y += lines.length * 4 + 2;
    }
  }
  y += 7;
  line();
  y += 12;
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  ink();
  doc.text('Presupuesto', left, y);
  y += 9;
  doc.setFontSize(8);
  muted();
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${budget.info.budgetNumber || '—'}  /  ${budget.info.date}`, left, y);
  y += 12;
  for (const [label, value] of [
    ['CLIENTE', budget.info.clientName],
    ['PROYECTO', budget.info.address],
  ] as const) {
    if (!value) continue;
    doc.setFontSize(7);
    muted();
    ensure(16);
    doc.text(label, left, y);
    y += 5;
    doc.setFontSize(10);
    ink();
    const lines = doc.splitTextToSize(value, right - left);
    for (const text of lines) {
      ensure(6);
      doc.text(text, left, y);
      y += 5;
    }
    y += 4;
  }
  y += 5;
  budget.workItems.forEach((item, index) => {
    const itemHeader = (continued = false) => {
      const heading = doc
        .splitTextToSize(
          `${String(index + 1).padStart(2, '0')}  ${item.name}${continued ? ' (continúa)' : ''}`,
          130,
        )
        .slice(0, 3);
      const height = heading.length * 5 + 10;
      ensure(height + 20);
      doc.setFillColor(236, 241, 231);
      doc.rect(left, y - 4, right - left, height, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      ink();
      doc.text(heading, left + 4, y + 2);
      doc.setFontSize(9);
      doc.text(fmt(workItemAmount(item, multiplier)), right - 4, y + 2, { align: 'right' });
      y += height + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      muted();
      doc.text('CONCEPTO', left, y);
      doc.text('CANT.', 120, y, { align: 'right' });
      doc.text('UD.', 131, y, { align: 'center' });
      doc.text('PRECIO', 161, y, { align: 'right' });
      doc.text('IMPORTE', right, y, { align: 'right' });
      y += 6;
    };
    itemHeader();
    for (const task of item.tasks) {
      doc.setFontSize(9);
      const lines: string[] = doc.splitTextToSize(task.description, 87);
      let offset = 0;
      while (offset < lines.length) {
        if (y + 14 > bottom) {
          newPage();
          itemHeader(true);
        }
        const capacity = Math.max(1, Math.floor((bottom - y - 9) / 3.81));
        const fragment = lines.slice(offset, offset + capacity);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        ink();
        doc.text(fragment, left, y, { lineHeightFactor: 1.2 });
        if (offset === 0) {
          doc.setFontSize(8.5);
          doc.text(task.quantity.toLocaleString('es-ES'), 120, y, { align: 'right' });
          doc.text(UNIT_LABELS[task.unit], 131, y, { align: 'center' });
          doc.text(fmt(unitPrice(task, multiplier)), 161, y, { align: 'right' });
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(taskAmount(task, multiplier)), right, y, { align: 'right' });
        }
        y += fragment.length * 3.81 + 5;
        offset += fragment.length;
        if (offset < lines.length) {
          newPage();
          itemHeader(true);
        }
      }
      line();
      y += 7;
    }
    y += 6;
  });
  const totals = budgetTotals(budget);
  ensure(65);
  y += 5;
  const summary = (label: string, value: number, strong = false) => {
    doc.setFontSize(strong ? 14 : 9);
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    ink();
    doc.text(label, 118, y);
    doc.text(fmt(value), right, y, { align: 'right' });
    y += strong ? 10 : 7;
  };
  if (multiplier < 1) {
    summary('Base', totals.raw);
    summary(`Descuento ${Math.round((1 - multiplier) * 100)}%`, totals.discount);
  }
  summary('Subtotal', totals.subtotal);
  summary(`IVA ${Math.round((budget.ivaRate ?? 0.1) * 100)}%`, totals.iva);
  line();
  y += 9;
  summary('TOTAL', totals.total, true);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 227, 216);
    doc.line(left, 282, right, 282);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    muted();
    doc.text('Preparado con budgenerator', left, 287);
    doc.text(`${page} / ${pages}`, right, 287, { align: 'right' });
  }
  return doc;
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
