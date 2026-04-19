import { useState } from 'react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { useProfileStore } from '@/entities/profile';
import { Input } from '@/shared/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { t } from '@/shared/i18n';

export function BudgetHeader() {
  const budget = useActiveBudget();
  const updateInfo = useBudgetStore((s) => s.updateInfo);
  const profile = useProfileStore((s) => s.profile);
  const clientInfoKey = `collapsed-clientinfo-${budget?.id ?? 'new'}`;
  const [showClientInfo, setShowClientInfo] = useState(() => {
    try {
      const stored = localStorage.getItem(clientInfoKey);
      return stored !== null ? stored === 'true' : true;
    } catch { return true; }
  });
  const toggleClientInfo = () =>
    setShowClientInfo((prev) => {
      localStorage.setItem(clientInfoKey, String(!prev));
      return !prev;
    });

  if (!budget) return null;
  const { info } = budget;

  const hasCompanyInfo = profile.name || profile.cif || profile.address || profile.phone || profile.email || profile.logo;

  return (
    <div>
      {hasCompanyInfo && (
        <div className="hidden print:flex mb-4 pb-4 border-b border-gray-100 text-sm text-gray-600 print:text-xs items-start gap-4">
          {profile.logo && (
            <img
              src={profile.logo}
              alt="Logo"
              className="h-12 w-auto object-contain shrink-0"
            />
          )}
          <div>
            {profile.name && <p className="font-semibold text-gray-900">{profile.name}</p>}
            {profile.cif && <p>CIF: {profile.cif}</p>}
            {profile.address && <p>{profile.address}</p>}
            <div className="flex gap-4 flex-wrap">
              {profile.phone && <p>Tel: {profile.phone}</p>}
              {profile.email && <p>{profile.email}</p>}
            </div>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">{t.header.title}</h1>
      <button
        onClick={toggleClientInfo}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer mb-3 no-print px-2 py-1.5 -ml-2 rounded hover:bg-gray-50 uppercase"
        aria-expanded={showClientInfo}
      >
        {showClientInfo ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {t.header.clientInfo}
      </button>
      <div className={`collapsible ${showClientInfo ? 'open' : ''} print:!grid-rows-[1fr]`}>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          id="clientName"
          label={t.header.clientName}
          value={info.clientName}
          onChange={(e) => updateInfo({ clientName: e.target.value })}
          placeholder={t.header.clientNamePlaceholder}
        />
        <Input
          id="address"
          label={t.header.address}
          value={info.address}
          onChange={(e) => updateInfo({ address: e.target.value })}
          placeholder={t.header.addressPlaceholder}
        />
        <Input
          id="date"
          label={t.header.date}
          type="date"
          value={info.date}
          onChange={(e) => updateInfo({ date: e.target.value })}
        />
        <Input
          id="budgetNumber"
          label={t.header.budgetNumber}
          value={info.budgetNumber}
          onChange={(e) => updateInfo({ budgetNumber: e.target.value })}
          placeholder={t.header.budgetNumberPlaceholder}
        />
        </div>
        </div>
      </div>
    </div>
  );
}
