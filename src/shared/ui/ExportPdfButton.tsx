import { useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';
import { t } from '@/shared/i18n';

/**
 * Safari (iOS & macOS) requires window.print() to be called directly
 * from a native event listener — not through React's synthetic event
 * delegation. We attach a native 'click' listener on mount.
 */
export function ExportPdfButton() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    const handle = () => window.print();
    btn.addEventListener('click', handle);
    return () => btn.removeEventListener('click', handle);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="no-print inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 min-h-[44px]"
    >
      <Printer size={16} />
      {t.export.button}
    </button>
  );
}
