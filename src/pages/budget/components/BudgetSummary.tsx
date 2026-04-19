import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { formatCurrency } from '@/shared/lib';

export function BudgetSummary() {
  const getSubtotal = useBudgetStore((s) => s.getSubtotal);
  const getIva = useBudgetStore((s) => s.getIva);
  const getTotal = useBudgetStore((s) => s.getTotal);
  const budget = useActiveBudget();

  if (!budget || budget.sections.length === 0) return null;

  const subtotal = getSubtotal();
  const iva = getIva();
  const total = getTotal();

  // Calculate total cost and margin
  const totalCost = budget.sections.reduce(
    (sum, s) => sum + s.rows.reduce((rs, r) => rs + r.cost * r.quantity, 0),
    0,
  );
  const marginAmount = subtotal - totalCost;
  const marginPercent = subtotal > 0 ? (marginAmount / subtotal) * 100 : 0;

  return (
    <div className="border-t-2 border-gray-300 pt-4 mt-6">
      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex justify-between w-64">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between w-64">
          <span className="text-gray-600">IVA (10%):</span>
          <span className="font-medium">{formatCurrency(iva)}</span>
        </div>
        <div className="flex justify-between w-64 border-t border-gray-300 pt-2 mt-1">
          <span className="text-gray-900 font-bold text-base">TOTAL:</span>
          <span className="font-bold text-base text-blue-700">{formatCurrency(total)}</span>
        </div>
        {totalCost > 0 && (
          <div className="flex justify-between w-64 border-t border-dashed border-gray-200 pt-2 mt-2 no-print">
            <span className="text-gray-500 text-xs">Margen beneficio:</span>
            <span className={`text-xs font-semibold ${marginAmount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(marginAmount)} ({marginPercent.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
