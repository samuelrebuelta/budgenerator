import { X } from 'lucide-react';
import { calculateProjectProgressHistory } from '@/entities/project/model/history';
import type { ProjectProgressMode, ProjectWorkItem } from '@/entities/project';
import { Button, Modal } from '@/shared/ui';

interface ProjectProgressHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  workItems: ProjectWorkItem[];
  mode: ProjectProgressMode;
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ProjectProgressHistoryDialog({
  open,
  onClose,
  workItems,
  mode,
}: ProjectProgressHistoryDialogProps) {
  const points = calculateProjectProgressHistory(workItems, mode);
  const minTime = points.length ? new Date(`${points[0]!.date}T12:00:00`).getTime() : 0;
  const maxTime = points.length ? new Date(`${points.at(-1)!.date}T12:00:00`).getTime() : 0;
  const coordinates = points.map((point) => ({
    ...point,
    x:
      points.length === 1
        ? 320
        : 48 +
          ((new Date(`${point.date}T12:00:00`).getTime() - minTime) / (maxTime - minTime || 1)) *
            544,
    y: 208 - (point.percent / 100) * 168,
  }));
  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Evolución del proyecto"
      overlayClassName="!box-border !px-3 !py-4 sm:!px-6"
      panelClassName="!w-[calc(100vw-3rem)] max-w-3xl"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1f2b26]">Evolución del proyecto</h2>
          <p className="mt-1 text-sm leading-6 text-[#52625a]">
            Avance acumulado según la fecha registrada en cada partida.
          </p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 p-2"
          aria-label="Cerrar evolución"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>

      {points.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c6d4cc] bg-[#f7f8f3] px-4 py-10 text-center">
          <p className="font-medium text-[#315c4c]">Aún no hay partidas terminadas</p>
          <p className="mt-1 text-sm text-[#637166]">
            La evolución aparecerá cuando registres el primer trabajo.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#e0e5de] bg-[#fbfcf9] p-2 sm:p-4">
            <svg
              viewBox="0 0 640 250"
              role="img"
              aria-labelledby="project-history-chart-title project-history-chart-description"
              className="h-auto w-full"
            >
              <title id="project-history-chart-title">
                Avance acumulado del proyecto por fecha
              </title>
              <desc id="project-history-chart-description">
                {points.length} {points.length === 1 ? 'fecha registrada' : 'fechas registradas'}.
                El avance más reciente es {points.at(-1)!.percent}%.
              </desc>
              {[0, 50, 100].map((tick) => {
                const y = 208 - (tick / 100) * 168;
                return (
                  <g key={tick} aria-hidden="true">
                    <line x1="48" x2="592" y1={y} y2={y} stroke="#e1e6df" strokeWidth="1" />
                    <text x="36" y={y + 4} textAnchor="end" fill="#637166" fontSize="11">
                      {tick}%
                    </text>
                  </g>
                );
              })}
              {points.length > 1 && <path d={path} fill="none" stroke="#39765e" strokeWidth="3" />}
              {coordinates.map((point) => (
                <circle
                  key={point.date}
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="#fbfcf9"
                  stroke="#39765e"
                  strokeWidth="3"
                >
                  <title>
                    {dateLabel(point.date)}: {point.percent}%
                  </title>
                </circle>
              ))}
              <text x="48" y="238" fill="#637166" fontSize="11">
                {dateLabel(points[0]!.date)}
              </text>
              {points.length > 1 && (
                <text x="592" y="238" textAnchor="end" fill="#637166" fontSize="11">
                  {dateLabel(points.at(-1)!.date)}
                </text>
              )}
            </svg>
          </div>

          <div className="mt-5 rounded-xl border border-[#e0e5de]">
            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">Detalle diario del avance acumulado</caption>
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[26%]" />
                <col className="w-[34%]" />
              </colgroup>
              <thead className="bg-[#f2f5f0] text-xs font-semibold text-[#52625a]">
                <tr>
                  <th scope="col" className="break-words px-2 py-2.5 sm:px-3">
                    Fecha
                  </th>
                  <th scope="col" className="break-words px-2 py-2.5 sm:px-3">
                    Avance
                  </th>
                  <th scope="col" className="break-words px-2 py-2.5 sm:px-3">
                    Partidas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ecece4]">
                {points.map((point) => (
                  <tr key={point.date}>
                    <th
                      scope="row"
                      className="break-words px-2 py-2.5 font-medium text-[#1f2b26] sm:px-3"
                    >
                      {dateLabel(point.date)}
                    </th>
                    <td className="break-words px-2 py-2.5 tabular-nums text-[#315c4c] sm:px-3">
                      {point.percent}%
                    </td>
                    <td className="break-words px-2 py-2.5 tabular-nums text-[#52625a] sm:px-3">
                      {point.completedConcepts} de{' '}
                      {workItems
                        .filter((workItem) => !workItem.voidedAt)
                        .reduce((count, workItem) => count + workItem.tasks.length, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#637166]">
            {mode === 'amount'
              ? 'La gráfica pondera cada partida por su importe neto.'
              : 'La gráfica pondera cada partida por igual.'}
          </p>
        </>
      )}
    </Modal>
  );
}
