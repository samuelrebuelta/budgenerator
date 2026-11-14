import { useMemo } from 'react';
import { t } from '@bg/domain/i18n';

export const MIN_PASSWORD_LENGTH = 8;

/** Same four checks as the web's registration form (`usePasswordStrength`). */
export function usePasswordStrength(password: string) {
  return useMemo(() => {
    const checks = [
      { label: t('login.passwordMinLength'), met: password.length >= MIN_PASSWORD_LENGTH },
      { label: t('login.passwordUppercase'), met: /[A-Z]/.test(password) },
      { label: t('login.passwordLowercase'), met: /[a-z]/.test(password) },
      { label: t('login.passwordNumber'), met: /\d/.test(password) },
    ];
    const score = checks.filter((check) => check.met).length;
    return { checks, score, allMet: score === checks.length };
  }, [password]);
}

export type PasswordStrength = ReturnType<typeof usePasswordStrength>;
