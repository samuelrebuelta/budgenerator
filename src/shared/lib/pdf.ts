import { jsPDF } from 'jspdf';
import type { Budget, CompanyProfile, WorkItem } from '@/shared/types';
import { UNIT_LABELS } from '@/shared/types';

interface PdfData {
  budget: Budget;
  company?: CompanyProfile;
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

async function loadImage(url: string): Promise<{ data: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // Get natural dimensions
    const dims: { width: number; height: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1, height: 1 });
      img.src = data;
    });
    return { data, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

export async function generateBudgetPdf({ budget, company }: PdfData) {
  const ivaRate = budget.ivaRate ?? 0.10;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ─── Company Header ───
  if (company?.name) {
    let logoOffset = 0;

    if (company.logo) {
      const img = await loadImage(company.logo);
      if (img) {
        const logoHeight = 16;
        const logoWidth = (img.width / img.height) * logoHeight;
        doc.addImage(img.data, 'JPEG', margin, y, logoWidth, logoHeight);
        logoOffset = logoWidth + 4;
      }
    }

    const textX = margin + logoOffset;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(company.name, textX, y + 5);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    if (company.cif) { doc.text(`CIF: ${company.cif}`, textX, y); y += 4; }
    if (company.address) { doc.text(company.address, textX, y); y += 4; }
    const contactLine: string[] = [];
    if (company.phone) contactLine.push(`Tel: ${company.phone}`);
    if (company.email) contactLine.push(company.email);
    if (contactLine.length) { doc.text(contactLine.join('    '), textX, y); y += 4; }

    if (logoOffset > 0) {
      y = Math.max(y, margin + 18);
    }
  }

  // ─── Separator ───
  y += 4;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ─── Title ───
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Presupuesto de Reforma', margin, y);
  y += 9;

  // ─── Client Info ───
  doc.setFontSize(9.5);
  const infoFields: [string, string][] = [];
  if (budget.info.clientName) infoFields.push(['Nombre del cliente:', budget.info.clientName]);
  if (budget.info.address) infoFields.push(['Dirección de la vivienda:', budget.info.address]);
  if (budget.info.date) infoFields.push(['Fecha:', budget.info.date]);
  if (budget.info.budgetNumber) infoFields.push(['Nº Presupuesto:', budget.info.budgetNumber]);

  infoFields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(label, margin, y);
    const labelWidth = doc.getTextWidth(label) + 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + labelWidth, y);
    y += 5.5;
  });

  y += 8;

  // ─── Work Items ───
  const multiplier = budget.adjustment?.multiplier ?? 1;

  budget.workItems.forEach((wi: WorkItem) => {
    const wiSubtotal = wi.tasks.reduce(
      (sum, task) => sum + task.quantity * task.price * (multiplier > 1 ? multiplier : 1),
      0,
    );

    // Estimate space: header(10) + tasks * 14 + padding(8)
    const estimatedHeight = 10 + wi.tasks.length * 14 + 8;
    ensureSpace(estimatedHeight);

    const cardX = margin;
    const cardStartY = y;
    const innerLeft = cardX + 5;
    const innerRight = cardX + contentWidth - 5;

    // ─ Card header with gray background (bg-gray-50) ─
    const headerHeight = 10;
    doc.setFillColor(249, 250, 251); // gray-50
    doc.rect(cardX, y, contentWidth, headerHeight, 'F');
    y += 6.5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(wi.name.toUpperCase(), innerLeft, y);

    doc.setTextColor(107, 114, 128); // gray-500 like the web
    doc.text(fmt(wiSubtotal), innerRight, y, { align: 'right' });
    y = cardStartY + headerHeight;

    // Header separator (at the bottom edge of the gray area)
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(cardX, y, cardX + contentWidth, y);
    y += 7;

    // ─ Tasks ─
    wi.tasks.forEach((task, idx) => {
      ensureSpace(14);
      const amount = task.quantity * task.price * (multiplier > 1 ? multiplier : 1);

      // Description + amount
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(task.description, innerLeft, y);
      doc.setFont('helvetica', 'normal');
      doc.text(fmt(amount), innerRight, y, { align: 'right' });
      y += 4.5;

      // Detail line
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(140, 140, 140);
      const detail = `${task.quantity} ${UNIT_LABELS[task.unit] || task.unit} × ${fmt(task.price)}`;
      doc.text(detail, innerLeft, y);
      y += 4;

      // Separator between tasks (not after last)
      if (idx < wi.tasks.length - 1) {
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.15);
        doc.line(innerLeft, y, innerRight, y);
        y += 6;
      }
    });

    y += 4;

    // ─ Draw card border ─
    const cardHeight = y - cardStartY;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardStartY, contentWidth, cardHeight, 2, 2, 'S');

    y += 8;
  });

  // ─── Totals ───
  const rawSubtotal = budget.workItems.reduce(
    (sum, wi) => sum + wi.tasks.reduce((s, task) => s + task.quantity * task.price, 0),
    0,
  );
  const subtotal = rawSubtotal * multiplier;
  const iva = subtotal * ivaRate;
  const total = subtotal + iva;

  ensureSpace(40);

  // Separator
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const labelX = pageWidth - margin - 60;
  const valueX = pageWidth - margin;

  doc.setFontSize(9.5);

  // Adjustment line (only discount)
  if (multiplier < 1) {
    const pct = Math.round((multiplier - 1) * 100);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Descuento (${pct}%)`, labelX, y);
    doc.setTextColor(40, 40, 40);
    doc.text(fmt(subtotal - rawSubtotal), valueX, y, { align: 'right' });
    y += 6;
  }

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal', labelX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmt(subtotal), valueX, y, { align: 'right' });
  y += 6;

  // IVA
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`IVA (${Math.round(ivaRate * 100)}%):`, labelX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmt(iva), valueX, y, { align: 'right' });
  y += 8;

  // TOTAL — #263f80
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(38, 63, 128);
  doc.text('TOTAL', labelX, y);
  doc.text(fmt(total), valueX, y, { align: 'right' });

  // ─── Save ───
  const filename = budget.info.clientName
    ? `presupuesto-${budget.info.clientName.toLowerCase().replace(/\s+/g, '-')}.pdf`
    : 'presupuesto.pdf';
  doc.save(filename);
}
