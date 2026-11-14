import { router } from 'expo-router';
import { HeaderIconButton } from './HeaderIconButton';

/** Account icon of the root tabs' header: opens the account menu sheet (BG-014 §4.2). */
export function AccountMenuButton() {
  return (
    <HeaderIconButton
      icon="user"
      label="Menú de la cuenta"
      onPress={() => router.push('/menu')}
      testID="account-menu-button"
    />
  );
}
