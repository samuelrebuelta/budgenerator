import { useId, useRef, useState, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
export function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <span className="info-control no-print">
      <button
        type="button"
        className="info-trigger"
        popoverTarget={id}
        aria-label={`Información sobre ${label.toLocaleLowerCase('es')}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!panel.current) return;
          panel.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 300))}px`;
          panel.current.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 190))}px`;
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      <span
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={`${id}-title`}
        className="info-popover"
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <span className="info-popover-heading">
          <strong id={`${id}-title`}>{label}</strong>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="Cerrar información"
          >
            <X size={16} />
          </button>
        </span>
        <span className="info-popover-copy">{children}</span>
      </span>
    </span>
  );
}
