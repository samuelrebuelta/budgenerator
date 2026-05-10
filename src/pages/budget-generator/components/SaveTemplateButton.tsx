import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import { useActiveBudget } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { generateId } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { BudgetTemplate } from '@/shared/types';

export function SaveTemplateButton() {
  const budget = useActiveBudget();
  const addTemplate = useTemplateStore((s) => s.addTemplate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!budget || !name.trim()) return;
    setSaveError(null);
    setSaving(true);
    try {
      const template: BudgetTemplate = {
        id: generateId(),
        name: name.trim(),
        workItems: budget.workItems,
        ...(budget.adjustment ? { adjustment: budget.adjustment } : {}),
        createdAt: new Date().toISOString(),
      };
      await addTemplate(template);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowInput(false);
        setName('');
      }, 1500);
    } catch (error) {
      console.error('Failed to save template', error);
      setSaveError(t('error.unknownError'));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Button variant="secondary" disabled>
        <Check size={16} className="text-green-600" />
        {t('templates.saved')}
      </Button>
    );
  }

  if (showInput) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (saveError) setSaveError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={t('templates.namePlaceholder')}
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[44px]"
          />
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? t('templates.saving') : t('common.save')}
          </Button>
          <Button variant="ghost" onClick={() => { setShowInput(false); setName(''); setSaveError(null); }}>
            {t('common.cancel')}
          </Button>
        </div>
        {saveError ? (
          <p className="text-sm text-red-600">{saveError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Button variant="secondary" onClick={() => { setShowInput(true); setSaveError(null); }}>
      <BookmarkPlus size={16} />
      {t('templates.saveAsTemplate')}
    </Button>
  );
}
