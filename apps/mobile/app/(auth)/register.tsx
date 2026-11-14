import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '@bg/domain/i18n';
import { markLegalAcceptance } from '@bg/domain/lib/legal';
import { colors } from '@bg/ui-tokens';
import { AuthScreen } from '../../src/features/auth/AuthScreen';
import { PasswordChecks } from '../../src/features/auth/PasswordChecks';
import { usePasswordStrength } from '../../src/features/auth/passwordStrength';
import { openLegalDocument } from '../../src/platform/webLinks';
import { useAuthStore } from '../../src/state/stores';
import { Button, Checkbox, Notice, Text, TextField } from '../../src/ui';

/**
 * Registration as on the web: the four password checks and the versioned acceptance of the
 * conditions (`markLegalAcceptance` → `users/{uid}.legalAcceptance` with `LEGAL_TERMS_VERSION`).
 * The legal texts open on the web in the system browser. The verification email is sent by the
 * shared auth repository; the notice lives in Presupuestos and Mi cuenta.
 */
export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const signUp = useAuthStore((state) => state.signUp);
  const error = useAuthStore((state) => state.error);
  const loading = useAuthStore((state) => state.loading);
  const clearError = useAuthStore((state) => state.clearError);
  const strength = usePasswordStrength(password);
  const canSubmit = Boolean(email) && strength.allMet && acceptedTerms && !loading;

  useEffect(() => clearError(), [clearError]);

  const submit = () => {
    if (!canSubmit) return;
    markLegalAcceptance();
    void signUp(email, password);
  };

  return (
    <AuthScreen title={t('login.signUp')}>
      <TextField
        label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('login.emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('login.passwordPlaceholder')}
        password
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {password.length > 0 ? <PasswordChecks {...strength} /> : null}
      <Checkbox
        checked={acceptedTerms}
        onChange={setAcceptedTerms}
        accessibilityLabel="He leído y acepto las condiciones de uso y la política de privacidad"
      >
        <Text variant="label" weight="regular" style={styles.terms}>
          He leído y acepto las{' '}
          <Text
            variant="label"
            weight="regular"
            accessibilityRole="link"
            onPress={() => void openLegalDocument('condiciones')}
            style={styles.link}
          >
            condiciones de uso
          </Text>{' '}
          y la{' '}
          <Text
            variant="label"
            weight="regular"
            accessibilityRole="link"
            onPress={() => void openLegalDocument('privacidad')}
            style={styles.link}
          >
            política de privacidad
          </Text>
          .
        </Text>
      </Checkbox>
      {error ? (
        <Notice tone="danger" plain>
          {error}
        </Notice>
      ) : null}
      <Button
        label={t('login.register')}
        icon="user-plus"
        fullWidth
        loading={loading}
        disabled={!canSubmit}
        onPress={submit}
      />
      <View style={styles.links}>
        <Button
          label={t('login.hasAccount')}
          variant="link"
          onPress={() => router.replace('/login')}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  terms: { color: colors['ink-soft'] },
  link: { textDecorationLine: 'underline', color: colors['ink-soft'] },
  links: { alignItems: 'center' },
});
