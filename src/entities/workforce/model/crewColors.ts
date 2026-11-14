import type { CrewColor } from '@/shared/types';

/** Crew palette; the values are the `--color-crew-*` tokens of `src/app/styles/tokens.css`. */
export const CREW_COLORS: {
  value: CrewColor;
  label: string;
  fill: string;
  ink: string;
  dot: string;
}[] = [
  { value: 'blue', label: 'Azul', ...crewTokens('blue') },
  { value: 'green', label: 'Verde', ...crewTokens('green') },
  { value: 'amber', label: 'Ámbar', ...crewTokens('amber') },
  { value: 'rose', label: 'Rosa', ...crewTokens('rose') },
  { value: 'violet', label: 'Violeta', ...crewTokens('violet') },
  { value: 'cyan', label: 'Turquesa', ...crewTokens('cyan') },
  { value: 'slate', label: 'Pizarra', ...crewTokens('slate') },
];

function crewTokens(color: CrewColor) {
  return {
    fill: `var(--color-crew-${color}-surface)`,
    ink: `var(--color-crew-${color}-ink)`,
    dot: `var(--color-crew-${color})`,
  };
}

export function colorFor(color: CrewColor) {
  return CREW_COLORS.find((item) => item.value === color) ?? CREW_COLORS[0]!;
}
