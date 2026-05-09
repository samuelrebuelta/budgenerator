import { Lock } from 'lucide-react';
import { t } from '@/shared/i18n';
import { FREE_BUDGET_LIMIT } from '@/entities/user';
import { CONTACT_EMAIL } from '@/shared/lib';

interface BudgetLimitReachedProps {
  totalBudgetsCreated: number;
}

export function BudgetLimitReached({ totalBudgetsCreated }: BudgetLimitReachedProps) {
  const contactText = t('budgetList.limitReachedContact', { email: CONTACT_EMAIL });
  const parts = contactText.split(CONTACT_EMAIL);

  return (
    <div className="text-center">
      <Lock size={40} className="mx-auto text-orange-400 mb-3" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('budgetList.limitReachedTitle')}</h3>
      <p className="text-sm text-gray-600 mb-2">{t('budgetList.limitReachedMessage')}</p>
      <p className="text-sm text-gray-500 mb-2">
        {t('budgetList.budgetsUsed', { used: totalBudgetsCreated, limit: FREE_BUDGET_LIMIT })}
      </p>
      <p className="text-sm text-gray-500">
        {parts[0]}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-blue-600 underline hover:text-blue-800"
        >
          {CONTACT_EMAIL}
        </a>
        {parts[1]}
      </p>
    </div>
  );
}
