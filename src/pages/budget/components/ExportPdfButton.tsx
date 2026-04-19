import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui';

export function ExportPdfButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => window.print()}
      className="no-print"
    >
      <Printer size={16} />
      Exportar PDF
    </Button>
  );
}
