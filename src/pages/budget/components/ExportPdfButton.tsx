import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function ExportPdfButton() {
  const handlePrint = () => {
    // Always defer to a macro-task: Safari (especially iOS/iPadOS) blocks
    // window.print() called from React synthetic event handlers.
    // iPadOS 13+ reports as "Macintosh" so UA sniffing is unreliable.
    setTimeout(() => {
      try {
        window.print();
      } catch {
        alert(t.export.iosAlert);
      }
    }, 100);
  };

  return (
    <Button
      variant="secondary"
      onClick={handlePrint}
      className="no-print"
    >
      <Printer size={16} />
      {t.export.button}
    </Button>
  );
}
