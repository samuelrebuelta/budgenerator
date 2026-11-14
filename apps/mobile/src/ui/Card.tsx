import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, nativeShadows, spacing } from '@bg/ui-tokens';
import { isAndroid } from './platform';
import { shapes } from './theme';

/**
 * Content surface. Content never goes on glass, so on iOS it is an inset-grouped style block
 * (opaque surface, 24 pt continuous corners, hairline edge because the brand canvas is close to
 * the surface); on Android a Material 3 elevated card
 * (12 dp, elevation level 1, which Android renders as shadow plus tonal lift).
 */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: shapes.card,
    padding: spacing[4],
    ...(isAndroid
      ? { elevation: 1, shadowColor: colors.ink }
      : {
          borderCurve: 'continuous',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          ...nativeShadows.card,
        }),
  },
});
