import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { RENOVATION_CATEGORIES } from '@/entities/catalog';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function AddWorkItemButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');
  const addWorkItem = useBudgetStore((s) => s.addWorkItem);
  const budget = useActiveBudget();

  const usedNames = useMemo(
    () => new Set(budget?.workItems.map((wi) => wi.name) ?? []),
    [budget],
  );

  const availableCategories = useMemo(
    () => RENOVATION_CATEGORIES.filter((c) => !usedNames.has(c)),
    [usedNames],
  );

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addWorkItem(trimmed);
    setName('');
    setIsOpen(false);
    setMode('catalog');
  };

  const handleSelectCategory = (cat: string) => {
    if (!cat) return;
    addWorkItem(cat);
    setName('');
    setIsOpen(false);
    setMode('catalog');
  };

  if (!isOpen) {
    return (
      <Button variant="secondary" onClick={() => setIsOpen(true)} className="no-print">
        <Plus size={16} />
        {t('addWorkItem.button')}
      </Button>
    );
  }

  return (
    <div className="no-print w-full flex-1 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      {/* Tabs */}
      <div className="flex w-full flex-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setMode('catalog')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
            mode === 'catalog'
              ? 'bg-white text-blue-700 font-medium shadow-sm ring-1 ring-gray-200'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('addWorkItem.fromCatalog')}
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
            mode === 'custom'
              ? 'bg-white text-blue-700 font-medium shadow-sm ring-1 ring-gray-200'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('addWorkItem.custom')}
        </button>
      </div>

      {mode === 'catalog' ? (
        <div>
          {availableCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className="text-sm px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 cursor-pointer transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t('addWorkItem.allAdded')}</p>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            placeholder={t('addWorkItem.customPlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <Button onClick={handleAdd}>{t('common.add')}</Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => { setIsOpen(false); setName(''); setMode('catalog'); }}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
