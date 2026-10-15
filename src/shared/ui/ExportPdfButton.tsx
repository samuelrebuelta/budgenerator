import { useState } from 'react';
import { Printer } from 'lucide-react';
import { assertBudget } from '@/shared/lib/budgetMath';
import { t } from '@/shared/i18n';
import type { Budget, PublicBudget, CompanyProfile } from '@/shared/types';

interface ExportPdfButtonProps {
  budget: Budget | PublicBudget;
  company?: CompanyProfile;
}

export function ExportPdfButton({ budget, company }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (loading) return;
    setError('');
    try {
      assertBudget(budget, true);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setLoading(true);
    // Pre-open window in user gesture context (iOS Safari blocks window.open after await)
    const pdfWindow = window.open('', '_blank');
    try {
      const { generateBudgetPdf } = await import('@/shared/lib/pdf');
      await generateBudgetPdf({ budget, company, pdfWindow });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido generar el PDF.');
      pdfWindow?.close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print">
      <button
        type="button"
        disabled={loading}
        onClick={handleExport}
        className="no-print inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer size={16} />
        {t('export.button')}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
