import type { Budget, CompanyProfile, WorkItem, BudgetTask } from '@/shared/types';
import { UNIT_LABELS } from '@/shared/types';
import { formatCurrency } from '@/shared/lib';
import { Printer } from 'lucide-react';
import { t } from '@/shared/i18n';

const IVA_RATE = 0.10;

function getTaskAmount(task: BudgetTask, multiplier: number): number {
  const raw = task.quantity * task.price;
  return raw * (multiplier > 1 ? multiplier : 1);
}

function getWorkItemSubtotal(wi: WorkItem, multiplier: number): number {
  return wi.tasks.reduce((sum, task) => sum + getTaskAmount(task, multiplier), 0);
}

interface Props {
  budget: Budget;
  company: CompanyProfile;
}

export function SharedBudgetView({ budget, company }: Props) {
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const rawSubtotal = budget.workItems.reduce(
    (sum, wi) => sum + wi.tasks.reduce((s, t) => s + t.quantity * t.price, 0),
    0,
  );
  const subtotal = rawSubtotal * multiplier;
  const isDiscount = multiplier < 1;
  const adjustmentPercent = Math.round((multiplier - 1) * 100);
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  const hasCompanyInfo = company.name || company.cif || company.address || company.phone || company.email || company.logo;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="max-w-5xl mx-auto py-4 sm:py-8 px-4 sm:px-6 print:max-w-none print:py-0 print:px-0 print:p-[10mm]">
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-8 print:shadow-none print:border-none print:rounded-none">
          {/* Company Header */}
          {hasCompanyInfo && (
            <div className="flex mb-4 pb-4 border-b border-gray-100 text-sm text-gray-600 items-start gap-4">
              {company.logo && (
                <img
                  src={company.logo}
                  alt="Logo"
                  className="h-12 w-auto object-contain shrink-0"
                />
              )}
              <div>
                {company.name && <p className="font-semibold text-gray-900">{company.name}</p>}
                {company.cif && <p>CIF: {company.cif}</p>}
                {company.address && <p>{company.address}</p>}
                <div className="flex gap-4 flex-wrap">
                  {company.phone && <p>Tel: {company.phone}</p>}
                  {company.email && <p>{company.email}</p>}
                </div>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">{t.header.title}</h1>

          {/* Client Info */}
          <div className="flex flex-col gap-1 mb-6 text-sm">
            {budget.info.clientName && (
              <p>
                <span className="text-gray-500">{t.header.clientName}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.clientName}</span>
              </p>
            )}
            {budget.info.address && (
              <p>
                <span className="text-gray-500">{t.header.address}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.address}</span>
              </p>
            )}
            {budget.info.date && (
              <p>
                <span className="text-gray-500">{t.header.date}:</span>{' '}
                <span className="font-medium text-gray-900">
                  {new Date(budget.info.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            )}
            {budget.info.budgetNumber && (
              <p>
                <span className="text-gray-500">{t.header.budgetNumber}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.budgetNumber}</span>
              </p>
            )}
          </div>

          {/* Work Items */}
          <div className="space-y-6">
            {budget.workItems.map((wi) => (
              <div key={wi.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* WorkItem Header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <span className="font-semibold text-gray-900 text-sm uppercase">{wi.name}</span>
                  <span className="text-sm font-medium text-gray-500">
                    {formatCurrency(getWorkItemSubtotal(wi, multiplier))}
                  </span>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-[1fr_10%_10%_12%_12%] gap-px bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                  <span>{t.common.description}</span>
                  <span className="text-right">{t.editor.quantity}</span>
                  <span className="text-center">{t.common.unit}</span>
                  <span className="text-right">{t.editor.price}</span>
                  <span className="text-right">{t.editor.amount}</span>
                </div>

                {/* Tasks */}
                {wi.tasks.map((task) => {
                  const amount = getTaskAmount(task, multiplier);
                  return (
                    <div key={task.id}>
                      {/* Desktop */}
                      <div className="hidden sm:grid grid-cols-[1fr_10%_10%_12%_12%] gap-px px-4 py-2 text-sm border-b border-gray-50 last:border-b-0">
                        <span className="text-gray-800">{task.description}</span>
                        <span className="text-right text-gray-600">{task.quantity}</span>
                        <span className="text-center text-gray-600">{UNIT_LABELS[task.unit] ?? task.unit}</span>
                        <span className="text-right text-gray-600">{formatCurrency(task.price)}</span>
                        <span className="text-right font-medium text-gray-700">{formatCurrency(amount)}</span>
                      </div>
                      {/* Mobile */}
                      <div className="sm:hidden px-4 py-3 border-b border-gray-50 last:border-b-0 space-y-1">
                        <p className="text-sm font-medium text-gray-800">{task.description}</p>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{task.quantity} {UNIT_LABELS[task.unit] ?? task.unit} × {formatCurrency(task.price)}</span>
                          <span className="font-semibold text-gray-700">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 pt-4 mt-6">
            <div className="flex flex-col items-end gap-1 text-sm">
              {/* Discount lines */}
              {isDiscount && (
                <div className="flex justify-between w-full max-w-72">
                  <span className="text-gray-600">{t.summary.subtotal}</span>
                  <span className="font-medium">{formatCurrency(rawSubtotal)}</span>
                </div>
              )}
              {isDiscount && (
                <div className="flex justify-between w-full max-w-72">
                  <span className="text-gray-600">
                    {t.summary.discount}
                    {budget.adjustment?.reason ? ` (${budget.adjustment.reason})` : ''}
                    {' '}{adjustmentPercent}%:
                  </span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(subtotal - rawSubtotal)}
                  </span>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-between w-full max-w-72">
                <span className="text-gray-600">
                  {isDiscount ? t.summary.adjustedSubtotal : t.summary.subtotal}
                </span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between w-full max-w-72">
                <span className="text-gray-600">{t.summary.iva}</span>
                <span className="font-medium">{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between w-full max-w-72 border-t border-gray-300 pt-2 mt-1">
                <span className="text-gray-900 font-bold text-base">{t.summary.total}</span>
                <span className="font-bold text-base text-blue-700">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Print button */}
          <div className="mt-6 flex justify-end no-print">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Printer size={16} />
              {t.export.button}
            </button>
          </div>
        </div>

        {/* Powered by */}
        <p className="text-center text-xs text-gray-400 mt-4 no-print">
          {t.share.poweredBy}
        </p>
      </div>
    </div>
  );
}
