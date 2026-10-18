import { useState } from 'react';
import { Printer } from 'lucide-react';
import { assertBudget } from '@/shared/lib/budgetMath';
import { t } from '@/shared/i18n';
import type { Budget, PublicBudget, CompanyProfile } from '@/shared/types';
import { Button } from './Button';

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
      <Button
        type="button"
        variant="secondary"
        loading={loading}
        onClick={handleExport}
        className="no-print"
      >
        <Printer size={16} />
        {t('export.button')}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
