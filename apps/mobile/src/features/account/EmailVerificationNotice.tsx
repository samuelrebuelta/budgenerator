import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@bg/ui-tokens';
import { repositories, useAuthStore } from '../../state/stores';
import { Button, Notice, Text } from '../../ui';

type Status = 'idle' | 'sending' | 'sent' | 'checking' | 'pending';

/**
 * Equivalent of the web's `EmailVerificationNotice`, with the same copy: shown while the email is
 * not verified. Sharing public links and publishing the estimator require it (Rules, Functions).
 */
export function EmailVerificationNotice({ reason }: { reason?: string }) {
  const emailVerified = useAuthStore((state) => state.emailVerified);
  const email = useAuthStore((state) => state.user?.email ?? '');
  const refreshVerification = useAuthStore((state) => state.refreshVerification);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  if (emailVerified) return null;

  const resend = async () => {
    setStatus('sending');
    setError('');
    try {
      await repositories.auth.resendVerificationEmail();
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('No se ha podido enviar el email. Espera unos minutos y vuelve a intentarlo.');
    }
  };

  const check = async () => {
    setStatus('checking');
    setError('');
    try {
      const verified = await refreshVerification();
      setStatus(verified ? 'idle' : 'pending');
    } catch {
      setStatus('idle');
      setError('No se ha podido comprobar. Revisa tu conexión.');
    }
  };

  return (
    <Notice tone="warning" title="Verifica tu email" icon="mail" testID="email-verification-notice">
      <Text variant="label" weight="regular" style={styles.ink}>
        Te hemos enviado un enlace a {email || 'tu email'}.{' '}
        {reason ?? 'Lo necesitas para publicar el estimador y proteger tu cuenta.'}
      </Text>
      {status === 'sent' ? (
        <Text variant="label" weight="regular" style={styles.ink}>
          Enviado. Revisa también la carpeta de spam.
        </Text>
      ) : null}
      {status === 'pending' ? (
        <Text variant="label" weight="regular" style={styles.ink}>
          Todavía no consta como verificado. Abre el enlace del email y vuelve a comprobarlo.
        </Text>
      ) : null}
      {error ? (
        <Text variant="label" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Ya lo he verificado"
          variant="secondary"
          loading={status === 'checking'}
          onPress={() => void check()}
        />
        <Button
          label="Reenviar email"
          variant="ghost"
          loading={status === 'sending'}
          onPress={() => void resend()}
        />
      </View>
    </Notice>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors['warning-ink'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
