import { useRef, useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import { useActiveBudgetRecord } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { Button } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function SaveTemplateButton() {
  const budget = useActiveBudgetRecord();
  const createTemplateFrom = useTemplateStore((s) => s.createTemplateFrom);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!budget || !name.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaveError(null);
    setSaving(true);
    try {
      await createTemplateFrom(budget.document, name.trim());
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
      savingRef.current = false;
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
      <div className="save-template-form">
        <div className="save-template-fields">
          <label className="sr-only" htmlFor="save-template-name">
            Nombre de la plantilla
          </label>
          <input
            id="save-template-name"
            disabled={saving}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (saveError) setSaveError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={t('templates.namePlaceholder')}
            autoFocus
            className="ui-control min-w-0"
          />
          <Button onClick={handleSave} disabled={!name.trim()} loading={saving}>
            {saving ? t('templates.saving') : t('common.save')}
          </Button>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setShowInput(false);
              setName('');
              setSaveError(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={() => {
        setShowInput(true);
        setSaveError(null);
      }}
    >
      <BookmarkPlus size={16} />
      {t('templates.saveAsTemplate')}
    </Button>
  );
}
