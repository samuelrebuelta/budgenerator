import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '@bg/domain/i18n';
import { spacing } from '@bg/ui-tokens';
import { AuthScreen } from '../../src/features/auth/AuthScreen';
import { useAuthStore } from '../../src/state/stores';
import { Button, Notice, TextField } from '../../src/ui';

/** Email/password sign-in with the web's copy and error messages (`t('login.*')`). */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAuthStore((state) => state.signIn);
  const error = useAuthStore((state) => state.error);
  const loading = useAuthStore((state) => state.loading);
  const clearError = useAuthStore((state) => state.clearError);

  useEffect(() => clearError(), [clearError]);

  const submit = () => {
    if (!email || !password || loading) return;
    void signIn(email, password);
  };

  return (
    <AuthScreen title={t('login.signIn')}>
      <TextField
        label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('login.emailPlaceholder')}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error ? (
        <Notice tone="danger" plain>
          {error}
        </Notice>
      ) : null}
      <Button
        label={t('login.enter')}
        icon="log-in"
        fullWidth
        loading={loading}
        disabled={!email || !password}
        onPress={submit}
      />
      <View style={styles.links}>
        <Button
          label={t('login.forgotPassword')}
          variant="link"
          onPress={() => router.push({ pathname: '/reset-password', params: { email } })}
        />
        <Button
          label={t('login.noAccount')}
          variant="link"
          onPress={() => router.replace('/register')}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', gap: spacing[1] },
});
