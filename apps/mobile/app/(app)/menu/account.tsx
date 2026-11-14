import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { t } from '@bg/domain/i18n';
import { toUserMessage } from '@bg/domain/lib/errors';
import { colors, spacing } from '@bg/ui-tokens';
import { EmailVerificationNotice } from '../../../src/features/account/EmailVerificationNotice';
import { LegalLinks } from '../../../src/features/legal/LegalLinks';
import { signOutAndWipe } from '../../../src/session';
import { useAuthStore, useUserStore } from '../../../src/state/stores';
import { Button, Card, Notice, Screen, Text } from '../../../src/ui';

function formatPlanDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Mi cuenta, basic data (web `AccountPage`): email, verification notice and plan without prices
 * or purchase calls (D7), plus sign-out, which wipes this account from the device (D3).
 * Password, notifications and account deletion arrive in phase 2.
 */
export default function AccountScreen() {
  const email = useAuthStore((state) => state.user?.email ?? '');
  const userData = useUserStore((state) => state.userData);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = userData?.accountData.plan ?? 'free';
  const premiumExpiresAt = userData?.accountData.premiumExpiresAt;
  const isExpired =
    plan === 'premium' && !!premiumExpiresAt && new Date(premiumExpiresAt) < new Date();

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOutAndWipe();
    } catch (e) {
      setSigningOut(false);
      setError(toUserMessage(e, 'No se ha podido cerrar la sesión. Inténtalo de nuevo.'));
    }
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Cerrar sesión',
      'Se borrarán de este dispositivo los datos guardados para usar sin conexión.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
      ],
    );

  return (
    <Screen edges={['bottom']}>
      <Text variant="label" tone="muted" weight="regular" testID="account-email">
        {email}
      </Text>
      <EmailVerificationNotice />
      {plan === 'premium' ? (
        <Notice
          tone={isExpired ? 'danger' : 'warning'}
          title={t('account.planPremium')}
          icon="award"
        >
          {!premiumExpiresAt
            ? t('account.premiumNoExpiry')
            : isExpired
              ? t('account.premiumExpiredOn', { date: formatPlanDate(premiumExpiresAt) })
              : t('account.premiumValidUntil', { date: formatPlanDate(premiumExpiresAt) })}
        </Notice>
      ) : (
        <Notice tone="info" title={t('account.planFree')} icon="star" />
      )}
      <Card style={styles.card}>
        <Text variant="label" weight="regular" tone="muted">
          La contraseña, los avisos y los datos de la cuenta se gestionan de momento desde la web.
        </Text>
      </Card>
      {error ? (
        <Notice tone="danger" plain>
          {error}
        </Notice>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Cerrar sesión"
          icon="log-out"
          variant="secondary"
          fullWidth
          loading={signingOut}
          onPress={confirmSignOut}
        />
      </View>
      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2], borderColor: colors.line },
  actions: { gap: spacing[2] },
});
