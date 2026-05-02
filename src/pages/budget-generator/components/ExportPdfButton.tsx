import { useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function ExportPdfButton() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    // Attach a native click listener so iOS Safari keeps the "user gesture"
    // chain intact. React synthetic events break it, causing window.print()
    // to silently fail on iOS Safari (iPhone / iPad).
    const handler = () => {
      try {
        window.print();
      } catch {
        alert(t.export.iosAlert);
      }
    };

    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  }, []);

  return (
    <Button
      ref={ref}
      variant="secondary"
      className="no-print"
    >
      <Printer size={16} />
      {t.export.button}
    </Button>
  );
}
