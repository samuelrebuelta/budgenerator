import Feather from '@expo/vector-icons/Feather';
import { SymbolView } from 'expo-symbols';
import { colors } from '@bg/ui-tokens';
import { SYSTEM_ICONS, type IconName } from './systemIcons';

export type { IconName } from './systemIcons';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Decorative icon: the control that holds it carries the accessible name. */
export function Icon({ name, size = 20, color = colors.ink }: IconProps) {
  const fallback = (
    <Feather
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
  const system = SYSTEM_ICONS[name];
  if (!system) return fallback;
  return (
    <SymbolView
      name={{ ios: system.sf, android: system.md }}
      size={size}
      tintColor={color}
      fallback={fallback}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
