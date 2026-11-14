import type { ComponentProps } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@bg/ui-tokens';

export type IconName = ComponentProps<typeof Feather>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/**
 * Feather icons (the set lucide, the web's icons, was forked from) bundled with
 * `@expo/vector-icons`. Decorative: the control that holds it carries the accessible name.
 */
export function Icon({ name, size = 20, color = colors.ink }: IconProps) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
