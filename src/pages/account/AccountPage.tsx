import { useNavigate } from 'react-router-dom';
import { KeyRound, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { useUserStore } from '@/entities/user';
import { CONTACT_EMAIL } from '@/shared/lib';
import { Card, PageLayout } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function AccountPage() {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.user?.email ?? '');
  const userData = useUserStore((s) => s.userData);
  const plan = userData?.accountData.plan ?? 'free';
  const premiumExpiresAt = userData?.accountData.premiumExpiresAt;
  const isExpired = plan === 'premium' && !!premiumExpiresAt && new Date(premiumExpiresAt) < new Date();

  return (
    <PageLayout>
      <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('account.title')}</h1>
          <p className="text-sm text-gray-500 mb-6">{email}</p>

          {/* Plan info */}
          {plan === 'premium' ? (
            <div className={`rounded-xl p-4 mb-6 border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={16} className={isExpired ? 'text-red-500' : 'text-amber-600'} />
                <span className={`font-semibold text-sm ${isExpired ? 'text-red-700' : 'text-amber-700'}`}>
                  {t('account.planPremium')}
                </span>
              </div>
              <p className={`text-sm ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                {!premiumExpiresAt
                  ? t('account.premiumNoExpiry')
                  : isExpired
                    ? t('account.premiumExpiredOn', {
                        date: new Date(premiumExpiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
                      })
                    : t('account.premiumValidUntil', {
                        date: new Date(premiumExpiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
                      })}
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4 mb-6 bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-blue-500" />
                <span className="font-semibold text-sm text-blue-700">{t('account.planFree')}</span>
              </div>
              <p className="text-sm text-blue-600 mb-2">{t('account.freeUpgradeHint')}</p>
              <p className="text-sm text-blue-700">
                {t('budgets.limitReachedContact', { email: CONTACT_EMAIL }).split(CONTACT_EMAIL)[0]}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium underline hover:text-blue-900"
                >
                  {CONTACT_EMAIL}
                </a>
                {t('budgets.limitReachedContact', { email: CONTACT_EMAIL }).split(CONTACT_EMAIL)[1]}
              </p>
            </div>
          )}

          <Card className="overflow-hidden">
            <button
              onClick={() => navigate('/account/password')}
              className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 cursor-pointer transition-colors"
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
          </Card>
      </div>
    </PageLayout>
  );
}
