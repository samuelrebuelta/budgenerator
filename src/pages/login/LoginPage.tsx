import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/entities/auth';
import { useUserStore } from '@/entities/user';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui';
import { Input } from '@/shared/ui';
import { Modal } from '@/shared/ui';
import { LogIn, UserPlus, Check, X, KeyRound, Eye, EyeOff } from 'lucide-react';
import { t } from '@/shared/i18n';
import { sendPasswordReset } from '@/entities/auth/api/firebase';

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const checks = [
      { label: t('login.passwordMinLength'), met: password.length >= 6 },
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
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { checks, score } = usePasswordStrength(password);
  const allChecksMet = score === checks.length;
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Initialize auth listener so loading becomes false
  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Redirect if already logged in
  const userData = useUserStore((s) => s.userData);
  const userLoaded = useUserStore((s) => s.loaded);

  useEffect(() => {
    if (user && !userLoaded) {
      useUserStore.getState().loadUserData(user.uid, user.email ?? '');
    }
  }, [user, userLoaded]);

  useEffect(() => {
    if (user && userData) {
      navigate('/', { replace: true });
    }
  }, [user, userData, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && !allChecksMet) return;
    if (isRegister) {
      await signUp(email, password);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-sm text-gray-500 mt-2">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isRegister ? t('login.signUp') : t('login.signIn')}
          </h2>

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
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  minLength={6}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
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

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full justify-center" disabled={loading || (isRegister && !allChecksMet)}>
              {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
              {isRegister ? t('login.register') : t('login.enter')}
            </Button>
          </form>

          {!isRegister && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={openResetModal}
                className="text-sm text-gray-500 hover:text-blue-600 cursor-pointer"
              >
                {t('login.forgotPassword')}
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              {isRegister
                ? t('login.hasAccount')
                : t('login.noAccount')}
            </button>
          </div>
        </div>
      </div>

      <Modal open={showReset} onClose={() => setShowReset(false)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          <KeyRound size={18} className="inline mr-2" />
          {t('login.resetPasswordTitle')}
        </h3>
        {resetSent ? (
          <div>
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-2">
              {t('login.resetPasswordSent')}
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              {t('login.resetPasswordSpamHint')}
            </p>
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
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                {resetError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowReset(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleResetPassword} disabled={resetLoading || !resetEmail}>
                {resetLoading ? t('common.loading') : t('login.resetPasswordButton')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
