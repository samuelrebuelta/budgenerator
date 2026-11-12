import type { CrewColor } from '@/shared/types';

export const CREW_COLORS: {
  value: CrewColor;
  label: string;
  fill: string;
  ink: string;
  dot: string;
}[] = [
  { value: 'blue', label: 'Azul', fill: '#dcece4', ink: '#183e3b', dot: '#367760' },
  { value: 'green', label: 'Verde', fill: '#e3edd7', ink: '#354b27', dot: '#648b43' },
  { value: 'amber', label: 'Ámbar', fill: '#f5e7cd', ink: '#68420d', dot: '#b4771e' },
  { value: 'rose', label: 'Rosa', fill: '#f4e0df', ink: '#733a3e', dot: '#b45e67' },
  { value: 'violet', label: 'Violeta', fill: '#ebe4f2', ink: '#514069', dot: '#8062a6' },
  { value: 'cyan', label: 'Turquesa', fill: '#d9eceb', ink: '#28575a', dot: '#3b8e94' },
  { value: 'slate', label: 'Pizarra', fill: '#e5e7e4', ink: '#3f4844', dot: '#68756e' },
];

export function colorFor(color: CrewColor) {
  return CREW_COLORS.find((item) => item.value === color) ?? CREW_COLORS[0]!;
}
