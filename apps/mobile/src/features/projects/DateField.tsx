import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dateFromKey, toDateKey } from '@bg/domain';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon, isIOS, systemColors, Text } from '../../ui';
import { formatCompactDate, formatProjectDate } from './model';

export interface DateFieldProps {
  /** `YYYY-MM-DD` or nothing (no date yet). */
  value?: string;
  /** Accessible name of the control («Fecha estimada de fin del proyecto»). */
  label: string;
  onChange: (dateKey: string) => void;
  /** Latest selectable day (`YYYY-MM-DD`), e.g. today for completion dates. */
  maximumDate?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Chip («14 nov») instead of the full date, for the item rows. */
  compact?: boolean;
  testID?: string;
}

/**
 * Native date picker (`@react-native-community/datetimepicker`, registro BG-014 paso 9):
 * - iOS with a date: the system compact date button, which opens the calendar in a popover.
 * - iOS without a date: a «Sin fecha» button that expands the inline calendar below it (the
 *   Calendar and Reminders pattern), so no fake date is shown before choosing one.
 * - Android: a Material 3 chip that opens the M3 date picker dialog.
 */
export function DateField({
  value,
  label,
  onChange,
  maximumDate,
  disabled = false,
  loading = false,
  compact = false,
  testID,
}: DateFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const current = dateFromKey(value ?? toDateKey(new Date()));
  const max = maximumDate ? dateFromKey(maximumDate) : undefined;
  const inactive = disabled || loading;
  const select = (date: Date | undefined) => {
    setExpanded(false);
    if (!date) return;
    const key = toDateKey(date);
    if (key !== value) onChange(key);
  };
  const spoken = value ? formatProjectDate(value) : 'sin fecha';
  const pickerProps = {
    value: current,
    mode: 'date' as const,
    locale: 'es-ES',
    accentColor: colors.primary,
    themeVariant: 'light' as const,
    maximumDate: max,
    accessibilityLabel: label,
    onValueChange: (_event: unknown, date: Date) => select(date),
    testID: testID ? `${testID}-picker` : undefined,
  };

  if (isIOS && value)
    return (
      <View style={styles.inline} testID={testID}>
        <DateTimePicker {...pickerProps} display="compact" disabled={inactive} />
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
    );

  const press = () => {
    if (isIOS) setExpanded((open) => !open);
    else
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        design: 'material',
        maximumDate: max,
        onValueChange: (_event, date) => select(date),
      });
  };

  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${spoken}`}
        accessibilityState={{ disabled: inactive, busy: loading, expanded: isIOS && expanded }}
        disabled={inactive}
        onPress={press}
        android_ripple={{ color: systemColors.ripple }}
        style={({ pressed }) => [
          styles.chip,
          compact && styles.compact,
          pressed && styles.pressed,
          inactive && styles.disabled,
        ]}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="calendar" size={compact ? 13 : 16} color={colors.primary} />
        )}
        <Text variant={compact ? 'caption' : 'label'} weight="medium" style={styles.text}>
          {value ? (compact ? formatCompactDate(value) : formatProjectDate(value)) : 'Sin fecha'}
        </Text>
      </Pressable>
      {isIOS && expanded ? <DateTimePicker {...pickerProps} display="inline" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1.5],
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: isIOS ? 10 : 8,
    borderWidth: 1,
    borderColor: colors['brand-200'],
    backgroundColor: colors.surface,
  },
  compact: { minHeight: 28, paddingHorizontal: spacing[2], borderRadius: 999 },
  pressed: { backgroundColor: colors['surface-muted'] },
  disabled: { opacity: 0.6 },
  text: { color: colors.primary },
});
