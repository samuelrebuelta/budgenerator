import { useState } from 'react';
import { KNOWN_UNITS, UNIT_LABELS, isKnownUnit } from '@/shared/types';

const OTHER = '__other__';

/**
 * Unit selector: the usual units in one tap, plus «Otra…» for any literal FIEBDC unit
 * (kg, m², pa…). Imported free units stay selectable as they are.
 */
export function UnitField({
  label,
  value,
  onChange,
  className,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (editing)
    return (
      <input
        id={id}
        aria-label={`${label} (otra unidad)`}
        autoFocus
        maxLength={20}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onChange(draft.trim());
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft('');
            setEditing(false);
          }
        }}
        className={className}
        placeholder="kg, pa, m…"
      />
    );
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => {
        if (event.target.value === OTHER) {
          setDraft(isKnownUnit(value) ? '' : value);
          setEditing(true);
        } else onChange(event.target.value);
      }}
      className={className}
    >
      {KNOWN_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {UNIT_LABELS[unit]}
        </option>
      ))}
      {value && !isKnownUnit(value) && <option value={value}>{value}</option>}
      <option value={OTHER}>Otra…</option>
    </select>
  );
}
