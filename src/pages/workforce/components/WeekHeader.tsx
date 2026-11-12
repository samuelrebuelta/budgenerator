import type { ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, type DateKey } from '@/shared/lib';
import { Button, IconButton } from '@/shared/ui';
import {
  formatDayLabel,
  formatLongDay,
  formatShortWeekday,
  formatWeekRange,
  scheduledItemCount,
  type WeekScheduleData,
} from '../model/schedule';

interface WeekHeaderProps {
  dateKeys: DateKey[];
  week: WeekScheduleData;
  selectedDayIndex: number;
  todayKey: DateKey;
  isCurrentWeek: boolean;
  offline: boolean;
  preview: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onPickDate: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectDay: (index: number) => void;
}

const weekArrowClass = 'shrink-0 text-ink-soft';

/** Week range (native date picker), week arrows, «Hoy» and the seven-day strip. */
export function WeekHeader({
  dateKeys,
  week,
  selectedDayIndex,
  todayKey,
  isCurrentWeek,
  offline,
  preview,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onPickDate,
  onSelectDay,
}: WeekHeaderProps) {
  const selectedDateKey = dateKeys[selectedDayIndex]!;
  const { range, year } = formatWeekRange(dateKeys);
  return (
    <div data-testid="week-selector" className="space-y-1">
      <div className="flex min-h-11 items-center justify-between gap-1">
        <label className="relative flex min-w-0 flex-1 cursor-pointer items-center focus-within:rounded-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <h2
            data-testid="week-range"
            className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold leading-tight text-ink sm:text-base"
          >
            {range} · {year}
          </h2>
          <input
            type="date"
            data-testid="week-date-picker"
            aria-label="Elegir semana por fecha"
            data-week-swipe-ignore
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={selectedDateKey}
            disabled={offline || preview}
            onChange={onPickDate}
          />
        </label>
        <div data-testid="week-selector-controls" className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label="Semana anterior"
            icon={<ChevronLeft size={18} aria-hidden="true" />}
            className={weekArrowClass}
            disabled={offline}
            onClick={onPreviousWeek}
          />
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-1.5 text-xs text-ink-soft sm:px-2"
            aria-label="Esta semana"
            onClick={onToday}
            disabled={offline || (isCurrentWeek && selectedDateKey === todayKey)}
          >
            <span className="sm:hidden">Hoy</span>
            <span className="hidden sm:inline">Esta semana</span>
          </Button>
          <IconButton
            label="Semana siguiente"
            icon={<ChevronRight size={18} aria-hidden="true" />}
            className={weekArrowClass}
            disabled={offline}
            onClick={onNextWeek}
          />
        </div>
      </div>
      <div className="grid grid-cols-7 border-y border-line py-1">
        {dateKeys.map((dateKey, index) => {
          const count = scheduledItemCount(dateKey, week);
          const selected = index === selectedDayIndex;
          const today = dateKey === todayKey;
          return (
            <button
              key={dateKey}
              type="button"
              data-day-key={preview ? undefined : dateKey}
              className="focus-ring flex min-h-[58px] flex-col items-center justify-center rounded-xl bg-transparent px-0.5 py-1 text-center"
              aria-label={formatLongDay(dateKey, true)}
              aria-pressed={!preview && selected}
              aria-current={!preview && today ? 'date' : undefined}
              onClick={preview ? undefined : () => onSelectDay(index)}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {formatShortWeekday(dateKey)}
              </span>
              <span
                data-testid="week-day-number"
                className={cn(
                  'mt-0.5 grid size-7 place-items-center rounded-full text-sm',
                  selected
                    ? 'bg-calendar-selected font-semibold text-white'
                    : today
                      ? 'font-bold text-calendar-selected'
                      : 'text-ink',
                )}
              >
                {formatDayLabel(dateKey, { day: 'numeric' })}
              </span>
              <span
                data-testid="week-day-dots"
                className="mt-0.5 flex h-1.5 items-center gap-1"
                aria-hidden="true"
              >
                {Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                  <span key={dot} className="size-1.5 rounded-full bg-info-ink" />
                ))}
              </span>
              <span className="sr-only">{count} asignaciones programadas</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
