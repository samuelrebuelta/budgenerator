import { Pressable, StyleSheet, View } from 'react-native';
import { KNOWN_UNITS, unitLabel } from '@bg/domain';
import { colors, spacing } from '@bg/ui-tokens';
import { systemColors, Text } from '../../ui';

/** Unit selector of the item and supplement sheets: the known units as radio chips. */
export function UnitPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (unit: string) => void;
  disabled?: boolean;
}) {
  const units: string[] = KNOWN_UNITS.includes(value as (typeof KNOWN_UNITS)[number])
    ? [...KNOWN_UNITS]
    : [...KNOWN_UNITS, value];
  return (
    <View style={styles.field}>
      <Text variant="label" weight="medium" style={styles.label}>
        Unidad
      </Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {units.map((unit) => {
          const selected = unit === value;
          return (
            <Pressable
              key={unit}
              accessibilityRole="radio"
              accessibilityLabel={unitLabel(unit)}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(unit)}
              android_ripple={{ color: systemColors.ripple }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text
                variant="label"
                weight={selected ? 'semibold' : 'regular'}
                style={selected ? styles.segmentTextSelected : null}
              >
                {unitLabel(unit)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { color: colors['ink-soft'] },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segment: {
    minWidth: 56,
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors['line-strong'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentSelected: {
    backgroundColor: systemColors.secondaryContainer,
    borderColor: colors.primary,
  },
  segmentTextSelected: { color: colors['ink-strong'] },
});
