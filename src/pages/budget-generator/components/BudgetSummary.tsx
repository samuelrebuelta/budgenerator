import { useState } from 'react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { formatCurrency } from '@/shared/lib';
import { Info, Minus, Plus, X } from 'lucide-react';
import { t } from '@/shared/i18n';

export function BudgetSummary() {
  const getRawSubtotal = useBudgetStore((s) => s.getRawSubtotal);
  const getSubtotal = useBudgetStore((s) => s.getSubtotal);
  const getIva = useBudgetStore((s) => s.getIva);
  const getTotal = useBudgetStore((s) => s.getTotal);
  const updateAdjustment = useBudgetStore((s) => s.updateAdjustment);
  const updateIvaRate = useBudgetStore((s) => s.updateIvaRate);
  const budget = useActiveBudget();

  const [editingType, setEditingType] = useState<'descuento' | 'recargo' | null>(null);
  const [editPercent, setEditPercent] = useState('');
  const [editReason, setEditReason] = useState('');
  const [showToast, setShowToast] = useState(false);

  if (!budget || budget.workItems.length === 0) return null;

  const rawSubtotal = getRawSubtotal();
  const subtotal = getSubtotal();
  const iva = getIva();
  const total = getTotal();
  const adjustment = budget.adjustment;
  const hasAdjustment = adjustment && adjustment.multiplier !== 1;
  const isSurcharge = hasAdjustment && adjustment.multiplier > 1;
  const isDiscount = hasAdjustment && adjustment.multiplier < 1;

  // Calculate total cost and margin
  const totalCost = budget.workItems.reduce(
    (sum, wi) => sum + wi.tasks.reduce((ts, t) => ts + t.cost * t.quantity, 0),
    0,
  );
  const marginAmount = subtotal - totalCost;
  const marginPercent = subtotal > 0 ? (marginAmount / subtotal) * 100 : 0;

  const adjustmentPercent = adjustment ? Math.round((adjustment.multiplier - 1) * 100) : 0;

  const startEditing = (type: 'descuento' | 'recargo') => {
    setEditingType(type);
    setEditPercent('');
    setEditReason('');
  };

  const applyEdit = () => {
    const pct = parseInt(editPercent, 10) || 0;
    if (pct === 0) return;
    const multiplier = editingType === 'descuento' ? 1 - Math.abs(pct) / 100 : 1 + Math.abs(pct) / 100;
    updateAdjustment({ multiplier, reason: editReason });
    setEditingType(null);
  };

  const removeAdjustment = () => {
    updateAdjustment(undefined);
    setEditingType(null);
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-6 section-break-avoid">
      <div className="flex flex-col items-end gap-1 text-sm">
        {/* ── Surcharge: info on screen only (concepts already include it) ── */}
        {isSurcharge && (
          <div className="flex justify-between w-full max-w-72 no-print">
            <span className="text-gray-600">{t('summary.rawSubtotal')}</span>
            <span className="font-medium">{formatCurrency(rawSubtotal)}</span>
          </div>
        )}
        {isSurcharge && (
          <div className="flex justify-between w-full max-w-72 no-print">
            <span className="text-gray-600 flex items-center gap-1">
              {t('summary.surcharge')}
              {adjustment.reason ? ` (${adjustment.reason})` : ''}
              {' '}+{adjustmentPercent}%:
              <button
                onClick={() => { setShowToast(true); setTimeout(() => setShowToast(false), 4000); }}
                className="text-gray-400 hover:text-blue-500 cursor-pointer"
                type="button"
                aria-label="Info"
              >
                <Info size={13} />
              </button>
            </span>
            <span className="font-medium text-red-600">
              +{formatCurrency(subtotal - rawSubtotal)}
            </span>
          </div>
        )}

        {/* ── Discount: raw subtotal + discount line (visible in PDF) ── */}
        {isDiscount && (
          <div className="flex justify-between w-full max-w-72">
            <span className="text-gray-600">{t('summary.subtotal')}</span>
            <span className="font-medium">{formatCurrency(rawSubtotal)}</span>
          </div>
        )}
        {isDiscount && (
          <div className="flex justify-between w-full max-w-72">
            <span className="text-gray-600">
              {t('summary.discount')}
              {adjustment.reason ? ` (${adjustment.reason})` : ''}
              {' '}{adjustmentPercent}%:
            </span>
            <span className="font-medium text-green-600">
              {formatCurrency(subtotal - rawSubtotal)}
            </span>
          </div>
        )}

        {/* ── Subtotal ── */}
        <div className="flex justify-between w-full max-w-72">
          <span className="text-gray-600">
            {isDiscount ? t('summary.adjustedSubtotal') : t('summary.subtotal')}
          </span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between w-full max-w-72 items-center">
          <span className="text-gray-600 flex items-center gap-1">
            IVA (
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round((budget.ivaRate ?? 0.10) * 100)}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value)));
                updateIvaRate(val / 100);
              }}
              className="w-10 text-center border border-gray-300 rounded px-1 py-0 text-sm no-print"
            />
            <span className="print:hidden">%):</span>
            <span className="hidden print:inline">{Math.round((budget.ivaRate ?? 0.10) * 100)}%):</span>
          </span>
          <span className="font-medium">{formatCurrency(iva)}</span>
        </div>
        <div className="flex justify-between w-full max-w-72 border-t border-gray-300 pt-2 mt-1">
          <span className="text-gray-900 font-bold text-base">{t('summary.total')}</span>
          <span className="font-bold text-base text-blue-700">{formatCurrency(total)}</span>
        </div>

        {/* Adjustment buttons */}
        <div className="no-print w-full max-w-72 mt-2">
          {!hasAdjustment && !editingType && (
            <div className="flex gap-2">
              <button
                onClick={() => startEditing('descuento')}
                className="text-xs text-green-600 hover:text-green-800 cursor-pointer flex items-center gap-1"
              >
                <Minus size={12} />
                {t('summary.addDiscount')}
              </button>
              <button
                onClick={() => startEditing('recargo')}
                className="text-xs text-red-600 hover:text-red-800 cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} />
                {t('summary.addSurcharge')}
              </button>
            </div>
          )}

          {hasAdjustment && !editingType && (
            <button
              onClick={removeAdjustment}
              className="text-xs text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1"
            >
              <X size={12} />
              {adjustmentPercent < 0 ? t('summary.removeDiscount') : t('summary.removeSurcharge')}
            </button>
          )}

          {editingType && (
            <div className="border border-gray-200 rounded-lg p-3 mt-1 bg-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {editingType === 'descuento' ? t('summary.newDiscount') : t('summary.newSurcharge')}
                </span>
                <button onClick={() => setEditingType(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">{t('summary.percentage')}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editPercent}
                    onChange={(e) => setEditPercent(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder={editingType === 'descuento' ? 'Ej. 10' : 'Ej. 15'}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">{t('summary.reason')}</label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder={t('summary.reasonPlaceholder')}
                  />
                </div>
              </div>
              <button
                onClick={applyEdit}
                className={`text-xs font-medium cursor-pointer ${
                  editingType === 'descuento'
                    ? 'text-green-600 hover:text-green-800'
                    : 'text-red-600 hover:text-red-800'
                }`}
              >
                {editingType === 'descuento' ? t('summary.applyDiscount') : t('summary.applySurcharge')}
              </button>
            </div>
          )}
        </div>

        {totalCost > 0 && (
          <div className="flex justify-between w-full max-w-72 border-t border-dashed border-gray-200 pt-2 mt-2 no-print">
            <span className="text-gray-500 text-xs">{t('summary.profitMargin')}</span>
            <span className={`text-xs font-semibold ${marginAmount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCurrency(marginAmount)} ({marginPercent.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 max-w-xs text-center no-print">
          {t('summary.surchargeInTasks', { pct: adjustmentPercent })}
        </div>
      )}
    </div>
  );
}
