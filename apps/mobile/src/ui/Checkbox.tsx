import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { Icon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the visible label may contain links. */
  accessibilityLabel: string;
  children: ReactNode;
}

/** Checkbox with a 44 pt target and a label that can hold inline links. */
export function Checkbox({ checked, onChange, accessibilityLabel, children }: CheckboxProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        hitSlop={8}
        onPress={() => onChange(!checked)}
        style={styles.target}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Icon name="check" size={14} color={colors['on-primary']} /> : null}
        </View>
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  target: { width: 32, minHeight: 32, alignItems: 'flex-start', justifyContent: 'flex-start' },
  box: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: radii.control / 2,
    borderWidth: 1.5,
    borderColor: colors['line-strong'],
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1 },
});
