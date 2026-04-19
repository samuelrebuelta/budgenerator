import { memo, useState } from 'react';
import { Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { AddRowButton } from './AddRowButton';
import { TariffSelector } from './TariffSelector';
import type { Unit, BudgetRow as BudgetRowType } from '@/shared/types';
import { formatCurrency } from '@/shared/lib';
import { Button, Modal } from '@/shared/ui';
import { EditableRow, EditableRowHeader } from '@/shared/ui/editable-row';
import type { ColumnDef } from '@/shared/ui/editable-row';
import { t } from '@/shared/i18n';

const BUDGET_COLUMNS: ColumnDef[] = [
  { key: 'description', label: t.common.description, width: 'minmax(0,1fr)' },
  { key: 'quantity', label: t.editor.quantity, width: '10%', align: 'right' },
  { key: 'unit', label: t.common.unit, width: '10%', align: 'center' },
  { key: 'price', label: t.editor.price, width: '12%', align: 'right' },
  { key: 'amount', label: t.editor.amount, width: '12%', align: 'right', mobileHidden: true },
  { key: 'margin', label: t.common.margin, width: '12%', align: 'right', className: 'no-print', mobileHidden: true },
];

/* ── Single Row (handles desktop + mobile) ── */
const BudgetRowItem = memo(function BudgetRowItem({
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
  // Subscribe to multiplier so memo re-renders when adjustment changes
  const _mult = useBudgetStore((s) => {
    const b = s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId);
    return b?.adjustment?.multiplier ?? 1;
  });
  void _mult;
  const amount = getRowAmount(row);

  return (
    <EditableRow
      columns={BUDGET_COLUMNS}
      cells={{
        description: { type: 'text', value: row.description, onChange: (v) => updateRow(sectionId, row.id, { description: v }), placeholder: t.common.description },
        quantity: { type: 'number', value: row.quantity, onChange: (v) => updateRow(sectionId, row.id, { quantity: parseFloat(v) || 0 }) },
        unit: { type: 'unit-select', value: row.unit, onChange: (v) => updateRow(sectionId, row.id, { unit: v as Unit }) },
        price: { type: 'number', value: row.price, onChange: (v) => updateRow(sectionId, row.id, { price: parseFloat(v) || 0 }), placeholder: '0.00' },
        amount: { type: 'display', content: <span className="font-medium text-gray-700">{formatCurrency(amount)}</span> },
        margin: {
          type: 'display',
          content: row.cost > 0 ? (
            <span className={`text-xs font-medium ${row.price > row.cost ? 'text-green-600' : row.price < row.cost ? 'text-red-500' : 'text-gray-400'}`}>
              {((row.price - row.cost) * row.quantity).toFixed(2)}€
              <span className="ml-1 text-gray-400">({row.price > 0 ? (((row.price - row.cost) / row.price) * 100).toFixed(0) : 0}%)</span>
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          ),
        },
      }}
      onDelete={() => removeRow(sectionId, row.id)}
      headerExtra={<TariffSelector sectionId={sectionId} rowId={row.id} sectionName={sectionName} />}
      mobileFooter={{ label: t.editor.amount, value: <span className="font-semibold text-gray-700">{formatCurrency(amount)}</span> }}
    />
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
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                {formatCurrency(getSectionSubtotal(section.id))}
              </span>
              <Button
                variant="danger"
              onClick={() => setDeletingSectionId(section.id)}
              className="no-print shrink-0"
            >
              <Trash2 size={14} />
            </Button>
            </div>
          </div>

          <div className={`collapsible print:grid-rows-[1fr]! ${collapsedSections.has(section.id) ? '' : 'open'}`}>
          <div className="overflow-hidden">
          <EditableRowHeader columns={BUDGET_COLUMNS} />
          <div className="space-y-2 sm:space-y-0 p-3 sm:p-0">
            {section.rows.map((row) => (
              <BudgetRowItem key={row.id} sectionId={section.id} row={row} sectionName={section.name} />
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
