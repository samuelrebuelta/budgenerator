import { useState } from 'react';
import { Printer } from 'lucide-react';
import { t } from '@/shared/i18n';
import type { Budget, CompanyProfile } from '@/shared/types';

interface ExportPdfButtonProps {
  budget: Budget;
  company?: CompanyProfile;
}

export function ExportPdfButton({ budget, company }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    // Pre-open window in user gesture context (iOS Safari blocks window.open after await)
    const pdfWindow = window.open('', '_blank');
    try {
      const { generateBudgetPdf } = await import('@/shared/lib/pdf');
      generateBudgetPdf({ budget, company, pdfWindow });
    } catch {
      pdfWindow?.close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleExport}
      className="no-print inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Printer size={16} />
      {t('export.button')}
    </button>
  );
}
