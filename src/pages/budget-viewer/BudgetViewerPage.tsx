import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSharedBudget, sharedBudgetView, type SharedBudget } from '@/entities/budget';
import { unitLabel } from '@/shared/types';
import { formatCurrency, formatQuantity } from '@/shared/lib';
import { Card, ExportPdfButton, OfflineUnavailable, Skeleton } from '@/shared/ui';
import {
  taskAmount as getTaskAmount,
  workItemSubtreeAmount,
  budgetTotals,
} from '@/shared/lib/budgetMath';
import { withTimeout } from '@/shared/model/session';
import { Brand } from '@/shared/ui/Brand';
import { t } from '@/shared/i18n';
import { getMemoryResource, loadMemoryResource } from '@/shared/lib/memoryResourceCache';
import { useNetworkStore } from '@/shared/model/network';

export function BudgetViewerPage() {
  const { token = '' } = useParams<{ token: string }>();
  return <PublicViewer key={token} token={token} />;
}
function PublicViewer({ token }: { token: string }) {
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const cacheKey = `public:shared-budget:${token}`;
  const cached = getMemoryResource<SharedBudget | null>(cacheKey);
  const [data, setData] = useState<SharedBudget | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined && online);
  const [error, setError] = useState(false);
  const view = useMemo(() => {
    try {
      return data ? sharedBudgetView(data) : null;
    } catch {
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const title = document.title;
    loadMemoryResource(cacheKey, () => withTimeout(fetchSharedBudget(token)))
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setData(result);
          const name = result.company?.name;
          if (name) document.title = t('share.pageTitle', { 0: name });
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      document.title = title;
    };
  }, [token, cacheKey, dataRefreshVersion]);

  if (loading && online) {
    return (
      <div
        className="min-h-screen bg-gray-100 px-4 py-8"
        role="status"
        aria-label="Cargando presupuesto"
      >
        <span className="sr-only">Cargando presupuesto</span>
        <div className="max-w-5xl mx-auto bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
          <Skeleton className="h-8 w-52 max-w-full mb-8" />
          <div className="space-y-3 mb-10">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-20 w-full mb-3" />
          ))}
          <Skeleton className="h-8 w-44 ml-auto mt-8" />
        </div>
      </div>
    );
  }

  if (!online && cached === undefined && !data) return <OfflineUnavailable />;

  if (error || !data || !view) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">{t('share.notFound')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('share.notFoundHint')}</p>
        </div>
      </div>
    );
  }

  const { company } = data;
  const budget = view!;
  const ivaRate = budget.ivaRate ?? 0.1;
  const multiplier = budget.adjustment?.multiplier ?? 1;
  const { raw: rawSubtotal, subtotal, iva, total } = budgetTotals({ ...budget, ivaRate });
  const isDiscount = multiplier < 1;
  const adjustmentPercent = Math.round((multiplier - 1) * 100);

  const hasCompanyInfo =
    company.name ||
    company.cif ||
    company.address ||
    company.phone ||
    company.email ||
    company.logo;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="max-w-5xl mx-auto py-4 sm:py-8 px-4 sm:px-6 print:max-w-none print:py-0 print:px-0 print:p-[10mm]">
        <Card className="p-4 sm:p-8 print:shadow-none print:border-none print:rounded-none">
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
                {company.cif && (
                  <p>
                    {t('profile.cif')}: {company.cif}
                  </p>
                )}
                {company.address && <p>{company.address}</p>}
                <div className="flex gap-4 flex-wrap">
                  {company.phone && (
                    <p>
                      {t('profile.phoneLabel')}: {company.phone}
                    </p>
                  )}
                  {company.email && <p className="break-all">{company.email}</p>}
                </div>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">
            {t('header.title')}
          </h1>

          {/* Client Info */}
          <div className="flex flex-col gap-1 mb-6 text-sm">
            {budget.info.clientName && (
              <p>
                <span className="text-gray-500">{t('header.clientName')}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.clientName}</span>
              </p>
            )}
            {budget.info.address && (
              <p>
                <span className="text-gray-500">{t('header.address')}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.address}</span>
              </p>
            )}
            {budget.info.date && (
              <p>
                <span className="text-gray-500">{t('header.date')}:</span>{' '}
                <span className="font-medium text-gray-900">
                  {new Date(budget.info.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </p>
            )}
            {budget.info.budgetNumber && (
              <p>
                <span className="text-gray-500">{t('header.budgetNumber')}:</span>{' '}
                <span className="font-medium text-gray-900">{budget.info.budgetNumber}</span>
              </p>
            )}
          </div>

          {/* Work Items */}
          <div className="space-y-6">
            {budget.workItems.map((wi, index) => (
              <div key={wi.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* WorkItem Header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <span className="font-semibold text-gray-900 text-sm uppercase">{wi.name}</span>
                  <span className="text-sm font-medium text-gray-500">
                    {formatCurrency(workItemSubtreeAmount(budget.workItems, index, multiplier))}
                  </span>
                </div>

                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-[1fr_10%_10%_12%_12%] gap-px bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                  <span>{t('common.description')}</span>
                  <span className="text-right">{t('editor.quantity')}</span>
                  <span className="text-center">{t('common.unit')}</span>
                  <span className="text-right">{t('editor.price')}</span>
                  <span className="text-right">{t('editor.amount')}</span>
                </div>

                {/* Tasks */}
                {wi.tasks.map((task) => {
                  const amount = getTaskAmount(task, multiplier);
                  return (
                    <div key={task.id}>
                      {/* Desktop */}
                      <div className="hidden sm:grid grid-cols-[1fr_10%_10%_12%_12%] gap-px px-4 py-2 text-sm border-b border-gray-50 last:border-b-0">
                        <span className="text-gray-800">{task.description}</span>
                        <span className="text-right text-gray-600">
                          {formatQuantity(task.quantity)}
                        </span>
                        <span className="text-center text-gray-600">{unitLabel(task.unit)}</span>
                        <span className="text-right text-gray-600">
                          {formatCurrency(task.price)}
                        </span>
                        <span className="text-right font-medium text-gray-700">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                      {/* Mobile */}
                      <div className="sm:hidden px-4 py-3 border-b border-gray-50 last:border-b-0 space-y-1">
                        <p className="text-sm font-medium text-gray-800">{task.description}</p>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>
                            {formatQuantity(task.quantity)} {unitLabel(task.unit)} ×{' '}
                            {formatCurrency(task.price)}
                          </span>
                          <span className="font-semibold text-gray-700">
                            {formatCurrency(amount)}
                          </span>
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
                  <span className="text-gray-600">{t('summary.subtotal')}</span>
                  <span className="font-medium">{formatCurrency(rawSubtotal)}</span>
                </div>
              )}
              {isDiscount && (
                <div className="flex justify-between w-full max-w-72">
                  <span className="text-gray-600">
                    {t('summary.discount')}
                    {budget.adjustment?.reason ? ` (${budget.adjustment.reason})` : ''}{' '}
                    {adjustmentPercent}%:
                  </span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(subtotal - rawSubtotal)}
                  </span>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex justify-between w-full max-w-72">
                <span className="text-gray-600">
                  {isDiscount ? t('summary.adjustedSubtotal') : t('summary.subtotal')}
                </span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between w-full max-w-72">
                <span className="text-gray-600">
                  {t('summary.iva', { 0: Math.round(ivaRate * 100) })}
                </span>
                <span className="font-medium">{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between w-full max-w-72 border-t border-gray-300 pt-2 mt-1">
                <span className="text-gray-900 font-bold text-base">{t('summary.total')}</span>
                <span className="font-bold text-base text-blue-700">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Export PDF button */}
          <div className="mt-6 flex justify-end">
            <ExportPdfButton budget={budget} company={company} />
          </div>
        </Card>

        {/* Powered by */}
        <p className="text-center text-xs text-gray-400 mt-4 no-print">
          <Brand />
        </p>
      </div>
    </div>
  );
}
