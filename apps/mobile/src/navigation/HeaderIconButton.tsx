import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@bg/ui-tokens';
import { Icon, isAndroid, systemColors, touchTarget, type IconName } from '../ui';

export interface HeaderIconButtonProps {
  icon: IconName;
  /** Accessible name; the button has no visible text. */
  label: string;
  onPress: () => void;
  testID?: string;
}

/**
 * Icon-only button of a native header. On iOS 26 the header places it as a bar button item on its
 * shared Liquid Glass background; on Android it is a Material 3 standard icon button (48 dp,
 * borderless ripple).
 */
export function HeaderIconButton({ icon, label, onPress, testID }: HeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={isAndroid ? 0 : 6}
      onPress={onPress}
      android_ripple={{ color: systemColors.ripple, borderless: true, radius: touchTarget / 2 }}
      style={styles.button}
      testID={testID}
    >
      <Icon
        name={icon}
        size={isAndroid ? 24 : 22}
        color={isAndroid ? colors.ink : colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
