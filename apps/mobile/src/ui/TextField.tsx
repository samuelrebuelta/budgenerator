import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing } from '@bg/ui-tokens';
import { Icon } from './Icon';
import { isAndroid } from './platform';
import { Text } from './Text';
import { controlHeight, fontFamily, shapes, systemColors, typography } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Password field with the web's «Mostrar/Ocultar contraseña» toggle. */
  password?: boolean;
  /** Keeps the label as the accessible name only (compact inline fields, e.g. the VAT rate). */
  hideLabel?: boolean;
  /** Helper text under the field (the web's field hint). */
  hint?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/**
 * Labelled input. The label stays above the field on both platforms (the web's form layout and
 * Dynamic Type friendly). iOS: rounded, filled field (12 pt continuous corners). Android: Material 3
 * outlined field (56 dp, 4 dp corners, 2 dp primary outline when focused).
 */
export function TextField({
  label,
  password = false,
  hideLabel = false,
  hint,
  ref,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {hideLabel ? null : (
        <Text variant="label" weight="medium" style={styles.label}>
          {label}
        </Text>
      )}
      <View style={styles.control}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors['ink-subtle']}
          secureTextEntry={password && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            focused && styles.focused,
            password && styles.inputWithToggle,
            props.editable === false && styles.readOnly,
          ]}
          {...props}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setVisible((value) => !value)}
            android_ripple={{ color: systemColors.ripple, borderless: true, radius: 24 }}
            style={styles.toggle}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={20} color={colors['ink-muted']} />
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const fieldHeight = isAndroid ? 56 : controlHeight + 4;

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { color: colors['ink-soft'] },
  control: { justifyContent: 'center' },
  input: {
    minHeight: fieldHeight,
    borderWidth: 1,
    borderColor: colors['line-strong'],
    borderRadius: shapes.field,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    paddingHorizontal: isAndroid ? spacing[4] : spacing[3],
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
  },
  // M3 focused outline is 2 dp in the primary colour; iOS keeps 1 pt and only changes colour.
  focused: { borderColor: colors.primary, borderWidth: isAndroid ? 2 : 1 },
  readOnly: { backgroundColor: colors['surface-muted'], color: colors['ink-muted'] },
  inputWithToggle: { paddingRight: spacing[12] },
  toggle: {
    position: 'absolute',
    right: 0,
    width: fieldHeight,
    height: fieldHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
