import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, nativeShadows, radii, spacing } from '@bg/ui-tokens';

/** Surface with the web card's radius, border and shadow. */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing[4],
    ...nativeShadows.card,
  },
});
