import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { Icon, Text } from '../../ui';
import type { PasswordStrength } from './passwordStrength';

/** Web: red → orange → yellow → green; here with the closest tokens. */
const barColor = (score: number) =>
  score <= 1
    ? colors['danger-solid']
    : score <= 2
      ? colors.accent
      : score <= 3
        ? colors['warning-line']
        : colors['success-ink'];

/** Strength bar and checklist shown under the password while registering. */
export function PasswordChecks({ checks, score }: PasswordStrength) {
  return (
    <View style={styles.wrap} testID="password-checks">
      <View
        style={styles.bars}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { backgroundColor: index <= score ? barColor(score) : colors['gray-200'] },
            ]}
          />
        ))}
      </View>
      {checks.map((check) => (
        <View
          key={check.label}
          style={styles.check}
          accessible
          accessibilityLabel={`${check.label}: ${check.met ? 'cumplido' : 'pendiente'}`}
        >
          <Icon
            name={check.met ? 'check' : 'x'}
            size={12}
            color={check.met ? colors['success-ink'] : colors['ink-subtle']}
          />
          <Text
            variant="caption"
            style={{ color: check.met ? colors['success-ink'] : colors['ink-subtle'] }}
          >
            {check.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  bars: { flexDirection: 'row', gap: spacing[1], marginBottom: spacing[1] },
  bar: { flex: 1, height: 6, borderRadius: radii.pill },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
});
