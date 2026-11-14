import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing } from '@bg/ui-tokens';
import { GlassSurface } from './GlassSurface';
import { Icon, type IconName } from './Icon';
import { useNativeLook, type NativeLook } from './platform';
import { Text } from './Text';
import { controlHeight, shapes, systemColors } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

interface Tone {
  background: string;
  pressed: string;
  text: string;
  /** Glass tint on iOS 26; `undefined` is clear glass. */
  tint?: string;
  ripple: string;
}

const transparent = 'transparent';

/**
 * Web variants mapped onto each platform (README «Diseño nativo»):
 * iOS 26 prominent glass (primary, danger) and clear glass (secondary); Material 3 filled,
 * filled tonal (secondary) and text buttons (ghost, link).
 */
const tones: Record<ButtonVariant, Tone> = {
  primary: {
    background: colors.primary,
    pressed: colors['primary-hover'],
    text: colors['on-primary'],
    tint: colors.primary,
    ripple: systemColors.rippleOnPrimary,
  },
  secondary: {
    background: colors.surface,
    pressed: colors['surface-muted'],
    text: colors.primary,
    ripple: systemColors.ripple,
  },
  danger: {
    background: colors['danger-solid'],
    pressed: colors['danger-ink'],
    text: colors['on-primary'],
    tint: colors['danger-solid'],
    ripple: systemColors.rippleOnPrimary,
  },
  ghost: {
    background: transparent,
    pressed: colors['surface-muted'],
    text: colors.ink,
    ripple: systemColors.ripple,
  },
  link: {
    background: transparent,
    pressed: transparent,
    text: colors.primary,
    ripple: systemColors.ripple,
  },
};

/** Material 3 filled tonal button: `secondaryContainer` with its «on» colour. */
const materialSecondary: Tone = {
  background: systemColors.secondaryContainer,
  pressed: systemColors.secondaryContainer,
  text: systemColors.onSecondaryContainer,
  ripple: systemColors.ripple,
};

/** Material 3 disabled state: on-surface at 12 % (container) and 38 % (content). */
const materialDisabled = { background: 'rgba(28, 48, 41, 0.12)', text: 'rgba(28, 48, 41, 0.38)' };

function toneFor(variant: ButtonVariant, look: NativeLook) {
  if (look === 'material' && variant === 'secondary') return materialSecondary;
  return tones[variant];
}

const hasContainer = (variant: ButtonVariant) => variant !== 'ghost' && variant !== 'link';

/** Button with the web's variants, the platform's shape and a 44 pt / 48 dp touch target. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const look = useNativeLook();
  const isDisabled = !!disabled || loading;
  const tone = toneFor(variant, look);
  const container = hasContainer(variant);
  const material = look === 'material';
  let textColor = tone.text;
  if (isDisabled && material) textColor = materialDisabled.text;
  else if (isDisabled && look === 'glass' && container) textColor = colors['ink-muted'];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : icon ? (
        <Icon name={icon} size={18} color={textColor} />
      ) : null}
      <Text variant="label" weight="semibold" style={{ color: textColor }}>
        {label}
      </Text>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      android_ripple={material ? { color: tone.ripple, foreground: true } : undefined}
      style={[
        styles.pressable,
        material && styles.clip,
        fullWidth && styles.fullWidth,
        // Glass must not be faded; elsewhere the web's 50 % disabled opacity (M3 has its own).
        isDisabled && (look === 'ios' || (look === 'glass' && !container)) && styles.disabled,
        style,
      ]}
      {...props}
    >
      {({ pressed }) =>
        look === 'glass' && container ? (
          <GlassSurface
            interactive
            tint={isDisabled ? undefined : tone.tint}
            style={[styles.base, styles.large]}
          >
            {content}
          </GlassSurface>
        ) : (
          <View
            style={[
              styles.base,
              container && !material && styles.large,
              variant === 'link' && styles.link,
              {
                backgroundColor:
                  isDisabled && material && container
                    ? materialDisabled.background
                    : pressed && !material
                      ? tone.pressed
                      : tone.background,
              },
              variant === 'secondary' && look === 'ios' && styles.outlined,
            ]}
          >
            {content}
          </View>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: shapes.button, borderCurve: 'continuous' },
  clip: { overflow: 'hidden' },
  base: {
    minHeight: controlHeight,
    paddingHorizontal: spacing[5],
    borderRadius: shapes.button,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  /** iOS 26 large buttons are 50 pt capsules. */
  large: { minHeight: 50 },
  outlined: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors['line-strong'] },
  link: { paddingHorizontal: spacing[2] },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
});
