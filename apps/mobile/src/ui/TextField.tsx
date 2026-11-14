import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing } from '@bg/ui-tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { controlHeight, fontFamily, typography } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Password field with the web's «Mostrar/Ocultar contraseña» toggle. */
  password?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Labelled input with the web's `Input` look (44 pt, control radius, strong border). */
export function TextField({ label, password = false, ref, ...props }: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label" weight="medium" style={styles.label}>
        {label}
      </Text>
      <View style={styles.control}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors['ink-subtle']}
          secureTextEntry={password && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, password && styles.inputWithToggle]}
          {...props}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setVisible((value) => !value)}
            style={styles.toggle}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={18} color={colors['ink-muted']} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[1] },
  label: { color: colors['ink-soft'] },
  control: { justifyContent: 'center' },
  input: {
    minHeight: controlHeight,
    borderWidth: 1,
    borderColor: colors['line-strong'],
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[3],
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
  },
  inputWithToggle: { paddingRight: spacing[12] },
  toggle: {
    position: 'absolute',
    right: 0,
    width: controlHeight,
    height: controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
