import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/entities/auth';
import { Brand } from '@/shared/ui/Brand';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal } from '@/shared/ui';
import { LogIn, UserPlus, Check, X, KeyRound, Eye, EyeOff } from 'lucide-react';
import { t } from '@/shared/i18n';
import { sendPasswordReset } from '@/entities/auth';
import { markWelcomeTourPending } from '@/features/app-tour/model';
import { safeNotificationLoginReturnPath } from '@/features/notifications/model/navigation';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { markLegalAcceptance } from '@/shared/lib/legal';

const MIN_PASSWORD_LENGTH = 8;

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const checks = [
      { label: t('login.passwordMinLength'), met: password.length >= MIN_PASSWORD_LENGTH },
      { label: t('login.passwordUppercase'), met: /[A-Z]/.test(password) },
      { label: t('login.passwordLowercase'), met: /[a-z]/.test(password) },
      { label: t('login.passwordNumber'), met: /\d/.test(password) },
    ];
    const score = checks.filter((c) => c.met).length;
    return { checks, score };
  }, [password]);
}

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);
  const clearError = useAuthStore((s) => s.clearError);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    from?: { pathname?: unknown; search?: unknown; hash?: unknown };
  } | null;
  const from = locationState?.from;
  const requestedPath =
    typeof from?.pathname === 'string'
      ? `${from.pathname}${typeof from.search === 'string' ? from.search : ''}${typeof from.hash === 'string' ? from.hash : ''}`
      : null;
  const returnPath = safeNotificationLoginReturnPath(requestedPath) ?? '/budgets';
  const { checks, score } = usePasswordStrength(password);
  const allChecksMet = score === checks.length;
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (user) navigate(returnPath, { replace: true });
  }, [user, navigate, returnPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && (!allChecksMet || !acceptedTerms)) return;
    if (isRegister) {
      markLegalAcceptance();
      const uid = await signUp(email, password);
      if (uid) markWelcomeTourPending(uid);
    } else {
      await signIn(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    clearError();
  };

  const handleResetPassword = async () => {
    setResetError(null);
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail);
      setResetSent(true);
    } catch (e) {
      setResetError((e as Error).message);
    } finally {
      setResetLoading(false);
    }
  };

  const openResetModal = () => {
    setResetEmail(email);
    setResetSent(false);
    setResetError(null);
    setShowReset(true);
  };

  return (
    <div className="login-page">
      <aside className="login-story">
        <Brand light />
        <div className="login-story-copy">
          <h1>Budgenerator</h1>
        </div>
        <div className="architectural-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <i />
        </div>
      </aside>
      <main className="login-form-area">
        <div className="w-full max-w-sm login-form">
          <div className="mb-8">
            <div className="mobile-login-brand">
              <Brand />
            </div>
            <h2 className="login-welcome">{isRegister ? t('login.signUp') : t('login.signIn')}</h2>
          </div>

          <div className="login-form-panel">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('login.email')}
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? t('login.passwordPlaceholder') : undefined}
                    required
                    minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isRegister && password.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= score
                              ? score <= 1
                                ? 'bg-red-400'
                                : score <= 2
                                  ? 'bg-orange-400'
                                  : score <= 3
                                    ? 'bg-yellow-400'
                                    : 'bg-green-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="space-y-0.5">
                      {checks.map((c) => (
                        <li
                          key={c.label}
                          className={`flex items-center gap-1.5 text-xs ${
                            c.met ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {c.met ? <Check size={12} /> : <X size={12} />}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {isRegister && (
                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span>
                    He leído y acepto las{' '}
                    <Link to="/legal/condiciones" target="_blank" className="underline">
                      condiciones de uso
                    </Link>{' '}
                    y la{' '}
                    <Link to="/legal/privacidad" target="_blank" className="underline">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>
              )}

              {error && (
                <Alert tone="danger" plain role="none">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full justify-center"
                disabled={loading || (isRegister && (!allChecksMet || !acceptedTerms))}
                loading={loading}
              >
                {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
                {isRegister ? t('login.register') : t('login.enter')}
              </Button>
            </form>

            {!isRegister && (
              <div className="mt-3 text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={openResetModal}
                  className="font-medium text-ink-muted"
                >
                  {t('login.forgotPassword')}
                </Button>
              </div>
            )}

            <div className="mt-4 text-center">
              <Button type="button" variant="link" onClick={toggleMode} className="font-medium">
                {isRegister ? t('login.hasAccount') : t('login.noAccount')}
              </Button>
            </div>
          </div>
          <LegalLinks className="mt-6 justify-center" />
        </div>
      </main>
      <Modal open={showReset} onClose={() => setShowReset(false)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          <KeyRound size={18} className="inline mr-2" />
          {t('login.resetPasswordTitle')}
        </h3>
        {resetSent ? (
          <div>
            <Alert tone="success" plain role="none" className="mb-2">
              {t('login.resetPasswordSent')}
            </Alert>
            <Alert tone="warning" plain role="none" className="mb-4">
              {t('login.resetPasswordSpamHint')}
            </Alert>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowReset(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">{t('login.resetPasswordMessage')}</p>
            <Input
              id="resetEmail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              required
            />
            {resetError && (
              <Alert tone="danger" plain role="none" className="mt-2">
                {resetError}
              </Alert>
            )}
            <div className="flex items-center justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowReset(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleResetPassword} disabled={!resetEmail} loading={resetLoading}>
                {resetLoading ? t('common.loading') : t('login.resetPasswordButton')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
