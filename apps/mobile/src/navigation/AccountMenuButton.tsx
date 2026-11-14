import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@bg/ui-tokens';
import { Icon } from '../ui';

/** Account icon of the root tabs' header: opens the menu modal (BG-014 §4.2). */
export function AccountMenuButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Menú de la cuenta"
      hitSlop={8}
      onPress={() => router.push('/menu')}
      style={styles.button}
      testID="account-menu-button"
    >
      <Icon name="user" size={22} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
