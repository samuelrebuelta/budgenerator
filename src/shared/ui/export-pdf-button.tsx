import { Printer } from 'lucide-react';
import { Button } from './button';
import { t } from '@/shared/i18n';

export function ExportPdfButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      className="no-print"
      onClick={() => window.print()}
    >
      <Printer size={16} />
      {t.export.button}
    </Button>
  );
}
