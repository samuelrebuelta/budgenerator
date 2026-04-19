import { memo, useState } from 'react';
import { Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { AddRowButton } from './AddRowButton';
import { TariffSelector } from './TariffSelector';
import { UNIT_LABELS } from '@/shared/types';
import type { Unit, BudgetRow as BudgetRowType } from '@/shared/types';
import { formatCurrency } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { Modal } from '@/shared/ui';
import { t } from '@/shared/i18n';

/* ── Memoized Row (desktop table) ── */
const DesktopRow = memo(function DesktopRow({
  sectionId,
  row,
  sectionName,
}: {
  sectionId: string;
  row: BudgetRowType;
  sectionName: string;
}) {
  const updateRow = useBudgetStore((s) => s.updateRow);
  const removeRow = useBudgetStore((s) => s.removeRow);
  const getRowAmount = useBudgetStore((s) => s.getRowAmount);
  const amount = getRowAmount(row);

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-2 sm:px-4 py-2">
        <div className="flex items-start gap-2">
          <input
            value={row.description}
            onChange={(e) => updateRow(sectionId, row.id, { description: e.target.value })}
            placeholder={t.common.description}
            className="w-full bg-transparent border-none outline-none text-sm min-w-0"
          />
          <TariffSelector sectionId={sectionId} rowId={row.id} sectionName={sectionName} />
        </div>
      </td>
      <td className="px-2 sm:px-4 py-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={row.quantity || ''}
          onChange={(e) => updateRow(sectionId, row.id, { quantity: parseFloat(e.target.value) || 0 })}
          className="w-full bg-transparent border-none outline-none text-right text-sm"
          placeholder="0"
        />
      </td>
      <td className="px-2 sm:px-4 py-2 text-center">
        <select
          value={row.unit}
          onChange={(e) => updateRow(sectionId, row.id, { unit: e.target.value as Unit })}
          className="bg-transparent border-none outline-none text-sm text-center cursor-pointer print:appearance-none"
        >
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </td>
      <td className="px-2 sm:px-4 py-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={row.price || ''}
          onChange={(e) => updateRow(sectionId, row.id, { price: parseFloat(e.target.value) || 0 })}
          className="w-full bg-transparent border-none outline-none text-right text-sm"
          placeholder="0.00"
        />
      </td>
      <td className="px-2 sm:px-4 py-2 text-right font-medium text-gray-700">
        {formatCurrency(amount)}
      </td>
      <td className="px-2 sm:px-4 py-2 text-right no-print">
        {row.cost > 0 ? (
          <span className={`text-xs font-medium ${
            row.price > row.cost ? 'text-green-600' : row.price < row.cost ? 'text-red-500' : 'text-gray-400'
          }`}>
            {((row.price - row.cost) * row.quantity).toFixed(2)}€
            <span className="ml-1 text-gray-400">
              ({row.price > 0 ? (((row.price - row.cost) / row.price) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-2 sm:px-4 py-2 text-center no-print">
        <button
          onClick={() => removeRow(sectionId, row.id)}
          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
});

/* ── Memoized Row (mobile card) ── */
const MobileRow = memo(function MobileRow({
  sectionId,
  row,
  sectionName,
}: {
  sectionId: string;
  row: BudgetRowType;
  sectionName: string;
}) {
  const updateRow = useBudgetStore((s) => s.updateRow);
  const removeRow = useBudgetStore((s) => s.removeRow);
  const getRowAmount = useBudgetStore((s) => s.getRowAmount);
  const amount = getRowAmount(row);

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          value={row.description}
          onChange={(e) => updateRow(sectionId, row.id, { description: e.target.value })}
          placeholder={t.common.description}
          className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0"
        />
        <TariffSelector sectionId={sectionId} rowId={row.id} sectionName={sectionName} />
        <button
          onClick={() => removeRow(sectionId, row.id)}
          className="p-2 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase">{t.editor.quantity}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={row.quantity || ''}
            onChange={(e) => updateRow(sectionId, row.id, { quantity: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase">{t.common.unit}</label>
          <select
            value={row.unit}
            onChange={(e) => updateRow(sectionId, row.id, { unit: e.target.value as Unit })}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm cursor-pointer"
          >
            {Object.entries(UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase">{t.editor.price}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={row.price || ''}
            onChange={(e) => updateRow(sectionId, row.id, { price: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right"
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-sm">
        <span className="text-gray-500 text-xs">{t.editor.amount}</span>
        <span className="font-semibold text-gray-700">{formatCurrency(amount)}</span>
      </div>
    </div>
  );
});

/* ── Main Editor ── */
export function BudgetEditor() {
  const budget = useActiveBudget();
  const sections = budget?.sections ?? [];
  const removeSection = useBudgetStore((s) => s.removeSection);
  const renameSection = useBudgetStore((s) => s.renameSection);
  const getSectionSubtotal = useBudgetStore((s) => s.getSectionSubtotal);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  const LS_KEY = `collapsed-sections-${budget?.id ?? ''}`;

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });

  if (sections.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg">{t.editor.emptySections}</p>
        <p className="text-sm mt-1">{t.editor.emptySectionsHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden section-break-avoid">
          {/* Section Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="no-print shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${collapsedSections.has(section.id) ? '-rotate-90' : ''}`}
                />
              </button>
              <GripVertical size={16} className="text-gray-400 shrink-0 no-print" />
              <input
                value={section.name}
                onChange={(e) => renameSection(section.id, e.target.value)}
                className="font-semibold text-gray-900 bg-transparent border-none outline-none text-sm print:font-bold min-w-0 uppercase"
              />
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                {formatCurrency(getSectionSubtotal(section.id))}
              </span>
            </div>
            <Button
              variant="danger"
              onClick={() => setDeletingSectionId(section.id)}
              className="no-print shrink-0"
            >
              <Trash2 size={14} />
            </Button>
          </div>

          <div className={`collapsible print:grid-rows-[1fr]! ${collapsedSections.has(section.id) ? '' : 'open'}`}>
          <div className="overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto scrollbar-none print:block!">
            <table className="w-full text-sm print:min-w-0">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 w-[36%]">{t.common.description}</th>
                  <th className="px-4 py-2 w-[10%] text-right">{t.editor.quantity}</th>
                  <th className="px-4 py-2 w-[10%] text-center">{t.common.unit}</th>
                  <th className="px-4 py-2 w-[12%] text-right">{t.editor.price}</th>
                  <th className="px-4 py-2 w-[12%] text-right">{t.editor.amount}</th>
                  <th className="px-4 py-2 w-[12%] text-right no-print">{t.common.margin}</th>
                  <th className="px-4 py-2 w-[8%] text-center no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {section.rows.map((row) => (
                  <DesktopRow key={row.id} sectionId={section.id} row={row} sectionName={section.name} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden p-3 space-y-2 print:hidden">
            {section.rows.map((row) => (
              <MobileRow key={row.id} sectionId={section.id} row={row} sectionName={section.name} />
            ))}
          </div>

          {/* Add Row */}
          <div className="px-4 py-2 border-t border-gray-100">
            <AddRowButton sectionId={section.id} />
          </div>
          </div>
          </div>
        </div>
      ))}

      <Modal open={!!deletingSectionId} onClose={() => setDeletingSectionId(null)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.editor.deleteSectionTitle}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t.editor.deleteSectionMessage}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingSectionId(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removeSection(deletingSectionId!);
              setDeletingSectionId(null);
            }}
          >
            {t.common.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
