import { memo, useState } from 'react';
import { Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { AddTaskButton } from './AddTaskButton';
import { TariffSelector } from './TariffSelector';
import type { Unit, BudgetTask as BudgetTaskType } from '@/shared/types';
import { formatCurrency } from '@/shared/lib';
import { Button, Modal, EditableRow, EditableRowHeader } from '@/shared/ui';
import type { ColumnDef } from '@/shared/ui';
import { t } from '@/shared/i18n';

const BUDGET_COLUMNS: ColumnDef[] = [
  { key: 'description', label: t.common.description, width: 'minmax(0,1fr)' },
  { key: 'quantity', label: t.editor.quantity, width: '10%', align: 'right' },
  { key: 'unit', label: t.common.unit, width: '10%', align: 'center' },
  { key: 'price', label: t.editor.price, width: '12%', align: 'right' },
  { key: 'amount', label: t.editor.amount, width: '12%', align: 'right', mobileHidden: true },
  { key: 'margin', label: t.common.margin, width: '12%', align: 'right', className: 'no-print', mobileHidden: true },
];

/* ── Single Task (handles desktop + mobile) ── */
const BudgetTaskItem = memo(function BudgetTaskItem({
  workItemId,
  task,
  workItemName,
}: {
  workItemId: string;
  task: BudgetTaskType;
  workItemName: string;
}) {
  const updateTask = useBudgetStore((s) => s.updateTask);
  const removeTask = useBudgetStore((s) => s.removeTask);
  const getTaskAmount = useBudgetStore((s) => s.getTaskAmount);
  // Subscribe to multiplier so memo re-renders when adjustment changes
  const _mult = useBudgetStore((s) => {
    const b = s.draftBudget ?? s.budgets.find((b) => b.id === s.activeBudgetId);
    return b?.adjustment?.multiplier ?? 1;
  });
  void _mult;
  const amount = getTaskAmount(task);

  return (
    <EditableRow
      columns={BUDGET_COLUMNS}
      cells={{
        description: { type: 'text', value: task.description, onChange: (v) => updateTask(workItemId, task.id, { description: v }), placeholder: t.common.description },
        quantity: { type: 'number', value: task.quantity, onChange: (v) => updateTask(workItemId, task.id, { quantity: parseFloat(v) || 0 }) },
        unit: { type: 'unit-select', value: task.unit, onChange: (v) => updateTask(workItemId, task.id, { unit: v as Unit }) },
        price: { type: 'number', value: task.price, onChange: (v) => updateTask(workItemId, task.id, { price: parseFloat(v) || 0 }), placeholder: '0.00' },
        amount: { type: 'display', content: <span className="font-medium text-gray-700">{formatCurrency(amount)}</span> },
        margin: {
          type: 'display',
          content: task.cost > 0 ? (
            <span className={`text-xs font-medium ${task.price > task.cost ? 'text-green-600' : task.price < task.cost ? 'text-red-500' : 'text-gray-400'}`}>
              {((task.price - task.cost) * task.quantity).toFixed(2)}€
              <span className="ml-1 text-gray-400">({task.price > 0 ? (((task.price - task.cost) / task.price) * 100).toFixed(0) : 0}%)</span>
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          ),
        },
      }}
      onDelete={() => removeTask(workItemId, task.id)}
      headerExtra={<TariffSelector workItemId={workItemId} taskId={task.id} workItemName={workItemName} />}
      mobileFooter={{ label: t.editor.amount, value: <span className="font-semibold text-gray-700">{formatCurrency(amount)}</span> }}
    />
  );
});

/* ── Main Editor ── */
export function BudgetEditor() {
  const budget = useActiveBudget();
  const workItems = budget?.workItems ?? [];
  const removeWorkItem = useBudgetStore((s) => s.removeWorkItem);
  const renameWorkItem = useBudgetStore((s) => s.renameWorkItem);
  const getWorkItemSubtotal = useBudgetStore((s) => s.getWorkItemSubtotal);
  const [deletingWorkItemId, setDeletingWorkItemId] = useState<string | null>(null);

  const LS_KEY = `collapsed-workitems-${budget?.id ?? ''}`;

  const [collapsedWorkItems, setCollapsedWorkItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleWorkItem = (id: string) =>
    setCollapsedWorkItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });

  if (workItems.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg">{t.editor.emptyWorkItems}</p>
        <p className="text-sm mt-1">{t.editor.emptyWorkItemsHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {workItems.map((workItem) => (
        <div key={workItem.id} className="border border-gray-200 rounded-lg overflow-hidden section-break-avoid">
          {/* WorkItem Header */}
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => toggleWorkItem(workItem.id)}
                className="no-print shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${collapsedWorkItems.has(workItem.id) ? '-rotate-90' : ''}`}
                />
              </button>
              <GripVertical size={16} className="text-gray-400 shrink-0 no-print" />
              <input
                value={workItem.name}
                onChange={(e) => renameWorkItem(workItem.id, e.target.value)}
                className="font-semibold text-gray-900 bg-transparent border-none outline-none text-sm print:font-bold min-w-0 uppercase"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
                {formatCurrency(getWorkItemSubtotal(workItem.id))}
              </span>
              <Button
                variant="danger"
              onClick={() => setDeletingWorkItemId(workItem.id)}
              className="no-print shrink-0"
            >
              <Trash2 size={14} />
            </Button>
            </div>
          </div>

          <div className={`collapsible print:grid-rows-[1fr]! ${collapsedWorkItems.has(workItem.id) ? '' : 'open'}`}>
          <div className="overflow-hidden">
          <EditableRowHeader columns={BUDGET_COLUMNS} />
          <div className="space-y-2 sm:space-y-0 p-3 sm:p-0">
            {workItem.tasks.map((task) => (
              <BudgetTaskItem key={task.id} workItemId={workItem.id} task={task} workItemName={workItem.name} />
            ))}
          </div>

          {/* Add Task */}
          <div className="px-4 py-2 border-t border-gray-100">
            <AddTaskButton workItemId={workItem.id} />
          </div>
          </div>
          </div>
        </div>
      ))}

      <Modal open={!!deletingWorkItemId} onClose={() => setDeletingWorkItemId(null)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.editor.deleteWorkItemTitle}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t.editor.deleteWorkItemMessage}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingWorkItemId(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removeWorkItem(deletingWorkItemId!);
              setDeletingWorkItemId(null);
            }}
          >
            {t.common.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
