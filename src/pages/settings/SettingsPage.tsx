import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { t } from '@/shared/i18n';

export function SettingsPage() {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.user?.email ?? '');

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mb-6">{email}</p>

          <div className="divide-y divide-gray-100">
            <button
              onClick={() => navigate('/settings/password')}
              className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50 rounded-lg px-3 -mx-3 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <KeyRound size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('settings.changePassword')}</p>
                  <p className="text-sm text-gray-500">{t('settings.changePasswordHint')}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
