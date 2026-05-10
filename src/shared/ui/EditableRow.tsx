import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { UNIT_LABELS } from '@/shared/types';

/* ── Column definition (shared across header + rows) ── */

export interface ColumnDef {
  key: string;
  label: string;
  width: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  /** Hide from the mobile 3-col grid (e.g. computed columns shown in footer) */
  mobileHidden?: boolean;
}

/* ── Cell content types ── */

export type CellDef =
  | { type: 'text'; value: string; onChange: (v: string) => void; placeholder?: string }
  | { type: 'number'; value: number; onChange: (v: string) => void; placeholder?: string; integer?: boolean }
  | { type: 'unit-select'; value: string; onChange: (v: string) => void }
  | { type: 'display'; content: ReactNode };

/* ── Header ── */

export function EditableRowHeader({ columns }: { columns: ColumnDef[] }) {
  const grid = columns.map((c) => c.width).join(' ') + ' 48px';
  return (
    <div
      className="hidden sm:grid bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100 print:grid"
      style={{ gridTemplateColumns: grid }}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className={`px-4 py-2 ${align(col.align)} ${col.className ?? ''}`}
        >
          {col.label}
        </div>
      ))}
      <div className="px-4 py-2 no-print" />
    </div>
  );
}

/* ── Row (responsive: grid on desktop, card on mobile) ── */

interface EditableRowProps {
  columns: ColumnDef[];
  cells: Record<string, CellDef>;
  onDelete: () => void;
  /** Extra elements next to description on both layouts (e.g. CatalogSelector) */
  headerExtra?: ReactNode;
  /** Footer line shown only on mobile */
  mobileFooter?: { label: string; value: ReactNode };
}

export function EditableRow({ columns, cells, onDelete, headerExtra, mobileFooter }: EditableRowProps) {
  const grid = columns.map((c) => c.width).join(' ') + ' 48px';
  const descCell = cells.description;
  const mobileFields = columns.filter((c) => !c.mobileHidden && c.key !== 'description');

  return (
    <div>
      {/* Desktop */}
      <div
        className="hidden sm:grid items-center hover:bg-gray-50/50 border-b border-gray-100 print:grid"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((col) => {
          const cell = cells[col.key];
          if (!cell) return <div key={col.key} />;
          const isDesc = col.key === 'description';
          return (
            <div key={col.key} className={`px-2 sm:px-4 py-2 ${align(col.align)} ${col.className ?? ''}`}>
              {isDesc ? (
                <div className="flex items-start gap-2">
                  {desktopCell(cell)}
                  {headerExtra}
                </div>
              ) : (
                desktopCell(cell)
              )}
            </div>
          );
        })}
        <div className="px-2 sm:px-4 py-2 text-center no-print">
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden print:hidden border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {descCell && descCell.type === 'text' && (
            <input
              value={descCell.value}
              onChange={(e) => descCell.onChange(e.target.value)}
              placeholder={descCell.placeholder}
              className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0"
            />
          )}
          {headerExtra}
          <button
            onClick={onDelete}
            className="p-2 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {mobileFields.map((col) => {
            const cell = cells[col.key];
            if (!cell) return null;
            return (
              <div key={col.key}>
                <label className="text-[10px] text-gray-500 uppercase">{col.label}</label>
                {mobileCell(cell)}
              </div>
            );
          })}
        </div>
        {mobileFooter && (
          <div className="flex justify-between items-center pt-1 border-t border-gray-100 text-sm">
            <span className="text-gray-500 text-xs">{mobileFooter.label}</span>
            {mobileFooter.value}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */

const ALIGN = { left: '', center: 'text-center', right: 'text-right' } as const;
function align(a?: 'left' | 'center' | 'right') { return ALIGN[a ?? 'left']; }

function desktopCell(cell: CellDef): ReactNode {
  switch (cell.type) {
    case 'text':
      return <input value={cell.value} onChange={(e) => cell.onChange(e.target.value)} placeholder={cell.placeholder} className="w-full bg-transparent border-none outline-none text-sm min-w-0" />;
    case 'number':
      return <input type="number" min={0} step={cell.integer ? '1' : '0.01'} value={cell.value || ''} onChange={(e) => cell.onChange(e.target.value)} className="w-full bg-transparent border-none outline-none text-right text-sm" placeholder={cell.placeholder ?? '0'} />;
    case 'unit-select':
      return (
        <select value={cell.value} onChange={(e) => cell.onChange(e.target.value)} className="bg-transparent border-none outline-none text-sm text-center cursor-pointer print:appearance-none">
          {Object.entries(UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
    case 'display':
      return cell.content;
  }
}

function mobileCell(cell: CellDef): ReactNode {
  switch (cell.type) {
    case 'text':
      return <input value={cell.value} onChange={(e) => cell.onChange(e.target.value)} placeholder={cell.placeholder} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />;
    case 'number':
      return <input type="number" min={0} step={cell.integer ? '1' : '0.01'} value={cell.value || ''} onChange={(e) => cell.onChange(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right" placeholder={cell.placeholder ?? '0'} />;
    case 'unit-select':
      return (
        <select value={cell.value} onChange={(e) => cell.onChange(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm cursor-pointer">
          {Object.entries(UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
    case 'display':
      return cell.content;
  }
}
