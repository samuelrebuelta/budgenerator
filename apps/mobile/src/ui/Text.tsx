import { Text as NativeText, StyleSheet, type TextProps as NativeTextProps } from 'react-native';
import { colors } from '@bg/ui-tokens';
import { fontFamily, typography } from './theme';

export type TextVariant = 'display' | 'title' | 'body' | 'label' | 'caption';
export type TextTone = 'default' | 'strong' | 'muted' | 'danger' | 'onPrimary';

export interface TextProps extends NativeTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

const toneColor: Record<TextTone, string> = {
  default: colors.ink,
  strong: colors['ink-strong'],
  muted: colors['ink-muted'],
  danger: colors['danger-ink'],
  onPrimary: colors['on-primary'],
};

const defaultWeight: Record<TextVariant, NonNullable<TextProps['weight']>> = {
  display: 'medium',
  title: 'semibold',
  body: 'regular',
  label: 'medium',
  caption: 'regular',
};

/** Text with the app's fonts and colours. `display` and `title` are exposed as headers. */
export function Text({ variant = 'body', tone = 'default', weight, style, ...props }: TextProps) {
  const family =
    variant === 'display' ? fontFamily.display : fontFamily[weight ?? defaultWeight[variant]];
  const isHeader = variant === 'display' || variant === 'title';
  return (
    <NativeText
      accessibilityRole={isHeader ? 'header' : undefined}
      style={[
        typography[variant],
        { fontFamily: family, color: toneColor[tone] },
        variant === 'display' && styles.display,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  // Same tight tracking as the web's h1 (-0.045em).
  display: { letterSpacing: -0.045 * typography.display.fontSize },
});
