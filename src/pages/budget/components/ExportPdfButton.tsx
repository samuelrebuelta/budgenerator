import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export function ExportPdfButton() {
  const handlePrint = () => {
    if (isIOS) {
      // iOS Safari blocks window.print() inside React synthetic events;
      // setTimeout defers it to a native task so Safari allows it
      setTimeout(() => {
        try {
          window.print();
        } catch {
          alert(t.export.iosAlert);
        }
      }, 100);
    } else {
      window.print();
    }
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
