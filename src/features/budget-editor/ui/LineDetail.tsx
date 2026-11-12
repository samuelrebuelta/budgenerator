import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useActiveBudgetRecord, useBudgetStore } from '@/entities/budget';
import {
  createRateResolver,
  findNode,
  measurementRunningValues,
  parseDecimal,
  type FiebdcMeasurementLine,
} from '@/entities/construction-document/model';
import { formatCurrency } from '@/shared/lib';
import { unitLabel } from '@/shared/types';
import { Button } from '@/shared/ui';

type LineDraft = FiebdcMeasurementLine;
const FACTORS = [
  ['units', 'Uds.'],
  ['length', 'Largo'],
  ['width', 'Ancho'],
  ['height', 'Alto'],
] as const;

const toFiebdc = (value: string) => value.trim().replace(',', '.');
const validNumber = (value: string | undefined) =>
  !value?.trim() || parseDecimal(toFiebdc(value)) !== null;

/** Optional FIEBDC detail of an item: measurement lines and price breakdown. */
export function LineDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const record = useActiveBudgetRecord();
  const setTaskMeasurements = useBudgetStore((s) => s.setTaskMeasurements);
  const setDirectTaskPrice = useBudgetStore((s) => s.setDirectTaskPrice);
  const node = record ? findNode(record.document.tree, taskId)?.node : undefined;
  const [lines, setLines] = useState<LineDraft[]>(() =>
    structuredClone(node?.measurement?.lines ?? []),
  );
  const [error, setError] = useState('');
  if (!record || !node) return null;
  const document = record.document;
  const concept = document.concepts[node.conceptId];
  const running = measurementRunningValues({ lines });

  const commit = (next: LineDraft[]) => {
    setLines(next);
    if (next.some((line) => FACTORS.some(([key]) => !validNumber(line[key])))) {
      setError('Revisa los números de las mediciones.');
      return;
    }
    try {
      setTaskMeasurements(
        taskId,
        next.map((line) => {
          const clean: FiebdcMeasurementLine = { type: line.type, comment: line.comment };
          for (const [key] of FACTORS) {
            const value = line[key];
            if (value?.trim()) clean[key] = toFiebdc(value);
          }
          if (line.bimIds) clean.bimIds = line.bimIds;
          return clean;
        }),
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se han podido guardar las mediciones.');
    }
  };
  const update = (index: number, patch: Partial<LineDraft>) =>
    commit(lines.map((line, current) => (current === index ? { ...line, ...patch } : line)));

  const { rate } = createRateResolver(document);
  const decomposition = concept?.decomposition ?? [];

  return (
    <section
      className="line-detail no-print border-b border-gray-100 bg-gray-50/70 px-3 py-3 sm:px-4"
      aria-label={`Detalle de ${concept?.summary || 'la partida'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-800">Mediciones</h4>
        <span className="text-xs text-gray-500">
          Código FIEBDC <code>{concept?.code}</code>
        </span>
      </div>
      {lines.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 pr-2 font-medium">Comentario o fórmula</th>
                {FACTORS.map(([key, label]) => (
                  <th key={key} className="py-1 px-1 text-right font-medium">
                    {label}
                  </th>
                ))}
                <th className="py-1 px-1 text-right font-medium">Parcial</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-gray-200">
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Comentario de la línea ${index + 1}`}
                      value={line.comment}
                      onChange={(event) => update(index, { comment: event.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1"
                      placeholder={line.type === '3' ? 'a*b*c' : 'Descripción'}
                    />
                  </td>
                  {FACTORS.map(([key, label]) => (
                    <td key={key} className="py-1 px-1">
                      <input
                        aria-label={`${label} de la línea ${index + 1}`}
                        inputMode="decimal"
                        value={line[key] ?? ''}
                        disabled={line.type === '1' || line.type === '2'}
                        onChange={(event) => update(index, { [key]: event.target.value })}
                        aria-invalid={!validNumber(line[key])}
                        className="w-16 rounded border border-gray-200 bg-white px-2 py-1 text-right"
                      />
                    </td>
                  ))}
                  <td className="py-1 px-1 text-right tabular-nums text-gray-700">
                    {running[index] === null
                      ? '—'
                      : running[index]!.toLocaleString('es-ES', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      aria-label={`Eliminar la línea ${index + 1}`}
                      onClick={() => commit(lines.filter((_, current) => current !== index))}
                      className="min-h-11 min-w-11 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          La cantidad se escribe directamente. Añade líneas para calcularla por dimensiones.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() =>
            commit([
              ...lines,
              {
                type: '',
                comment: '',
                units: lines.length
                  ? '1'
                  : node.quantity && node.quantity !== '0'
                    ? node.quantity
                    : '1',
              },
            ])
          }
        >
          <Plus size={14} /> Añadir línea de medición
        </Button>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>

      {decomposition.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-800">Descomposición del precio</h4>
          <ul className="mt-1 divide-y divide-gray-200 text-sm">
            {decomposition.map((line, index) => {
              const child = document.concepts[line.conceptId];
              const amount =
                (parseDecimal(line.factor, 1) ?? 1) *
                (parseDecimal(line.yield, 1) ?? 1) *
                (child ? rate(child.id) : 0);
              return (
                <li key={index} className="flex flex-wrap justify-between gap-2 py-1">
                  <span>
                    <code className="text-xs text-gray-500">{child?.code}</code> {child?.summary}
                  </span>
                  <span className="tabular-nums text-gray-600">
                    {line.yield || '1'} {unitLabel(child?.unit ?? '')}
                    {child?.code.includes('%') ? '' : ` · ${formatCurrency(amount)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <Button
            variant="ghost"
            className="mt-1 text-xs"
            onClick={() => setDirectTaskPrice(taskId)}
          >
            Usar el precio como precio directo
          </Button>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Button variant="ghost" className="text-xs" onClick={onClose}>
          Cerrar detalle
        </Button>
      </div>
    </section>
  );
}
