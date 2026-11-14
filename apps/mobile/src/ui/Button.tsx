import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { Text } from './Text';
import { controlHeight } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<ButtonVariant, { background: string; pressed: string; text: string }> = {
  primary: {
    background: colors.primary,
    pressed: colors['primary-hover'],
    text: colors['on-primary'],
  },
  secondary: { background: colors.surface, pressed: colors['surface-muted'], text: colors.ink },
  danger: {
    background: colors['danger-solid'],
    pressed: colors['danger-ink'],
    text: colors['on-primary'],
  },
};

/** Button with the web's variants and a 44 pt touch target. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const tone = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? tone.pressed : tone.background },
        variant === 'secondary' && styles.secondary,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={tone.text} /> : null}
      <Text variant="label" weight="semibold" style={{ color: tone.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: controlHeight,
    paddingHorizontal: spacing[4],
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  secondary: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors['line-strong'] },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
});
