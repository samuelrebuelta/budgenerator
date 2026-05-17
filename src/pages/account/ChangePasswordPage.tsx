import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff } from 'lucide-react';
import { changePassword } from '@/entities/auth/api/firebase';
import { Button, Input, PageLayout } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const hasMinLength = newPassword.length >= 6;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError(t('settings.wrongPassword'));
      } else if (code === 'auth/too-many-requests') {
        setError(t('settings.tooManyRequests'));
      } else {
        setError(t('settings.changePasswordError'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <PageLayout>
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <Check size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.passwordChanged')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('settings.passwordChangedHint')}</p>
            <Button onClick={() => navigate('/account')}>
              {t('settings.backToSettings')}
            </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.changePasswordTitle')}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                id="currentPassword"
                label={t('settings.currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('settings.currentPasswordPlaceholder')}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <Input
                id="newPassword"
                label={t('settings.newPassword')}
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {newPassword.length > 0 && (
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className={hasMinLength ? 'text-green-600' : 'text-gray-400'}>
                  {hasMinLength ? '✓' : '○'} {t('login.passwordMinLength')}
                </span>
                <span className={hasUpper ? 'text-green-600' : 'text-gray-400'}>
                  {hasUpper ? '✓' : '○'} {t('login.passwordUppercase')}
                </span>
                <span className={hasLower ? 'text-green-600' : 'text-gray-400'}>
                  {hasLower ? '✓' : '○'} {t('login.passwordLowercase')}
                </span>
                <span className={hasNumber ? 'text-green-600' : 'text-gray-400'}>
                  {hasNumber ? '✓' : '○'} {t('login.passwordNumber')}
                </span>
              </div>
            )}

            <Input
              id="confirmPassword"
              label={t('settings.confirmPassword')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.confirmPasswordPlaceholder')}
              required
            />

            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-500">{t('settings.passwordsDoNotMatch')}</p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!isValid || saving}>
                {saving ? t('common.saving') : t('settings.changePasswordButton')}
              </Button>
            </div>
          </form>
        </div>
    </PageLayout>
  );
}
