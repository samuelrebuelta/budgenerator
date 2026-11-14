import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { mapAuthError } from '@bg/app-core/stores/auth';
import { t } from '@bg/domain/i18n';
import { spacing } from '@bg/ui-tokens';
import { AuthScreen } from '../../src/features/auth/AuthScreen';
import { repositories } from '../../src/state/stores';
import { Button, Notice, Text, TextField } from '../../src/ui';

/** Password recovery (the web's modal on the login page) as its own screen (§4.1). */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const send = async () => {
    setError(null);
    setLoading(true);
    try {
      await repositories.auth.sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title={t('login.resetPasswordTitle')}>
      {sent ? (
        <>
          <Notice tone="success" plain>
            {t('login.resetPasswordSent')}
          </Notice>
          <Notice tone="warning" plain>
            {t('login.resetPasswordSpamHint')}
          </Notice>
          <Button label={t('common.close')} variant="secondary" fullWidth onPress={close} />
        </>
      ) : (
        <>
          <Text variant="label" weight="regular" tone="muted">
            {t('login.resetPasswordMessage')}
          </Text>
          <TextField
            label={t('login.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('login.emailPlaceholder')}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          {error ? (
            <Notice tone="danger" plain>
              {error}
            </Notice>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={loading ? t('common.loading') : t('login.resetPasswordButton')}
              fullWidth
              loading={loading}
              disabled={!email}
              onPress={() => void send()}
            />
            <Button label={t('common.cancel')} variant="secondary" fullWidth onPress={close} />
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing[2] },
});
