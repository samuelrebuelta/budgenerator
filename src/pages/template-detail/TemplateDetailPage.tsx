import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { BudgetEditor } from '@/pages/budget-detail/components/BudgetEditor';
import { AddWorkItemButton } from '@/pages/budget-detail/components/AddWorkItemButton';
import { BudgetSummary } from '@/pages/budget-detail/components/BudgetSummary';
import { Button, Card, ConfirmModal, Input, Skeleton } from '@/shared/ui';
import { generateId } from '@/shared/lib';
import { t } from '@/shared/i18n';

export function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const isNew = templateId === 'new';

  const templates = useTemplateStore((s) => s.templates);
  const templatesLoaded = useTemplateStore((s) => s.loaded);
  const addTemplate = useTemplateStore((s) => s.addTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);

  const loadTemplateForEditing = useBudgetStore((s) => s.loadTemplateForEditing);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const activeBudget = useActiveBudget();

  const template = isNew ? null : templates.find((tpl) => tpl.id === templateId);
  const [templateName, setTemplateName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const partidasKey = `collapsed-partidas-template-${templateId ?? ''}`;
  const [showPartidas, setShowPartidas] = useState(() => {
    try {
      const stored = localStorage.getItem(partidasKey);
      return stored !== null ? stored === 'true' : true;
    } catch { return true; }
  });
  const togglePartidas = () =>
    setShowPartidas((prev) => {
      localStorage.setItem(partidasKey, String(!prev));
      return !prev;
    });

  useEffect(() => {
    if (isNew && !loadedRef.current) {
      loadTemplateForEditing({
        id: '',
        name: '',
        workItems: [],
        createdAt: '',
      });
      loadedRef.current = true;
    } else if (template && !loadedRef.current) {
      loadTemplateForEditing(template);
      setTemplateName(template.name);
      loadedRef.current = true;
    }
    return () => {
      discardDraft();
      loadedRef.current = false;
    };
  }, [templateId, template]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isNew && templatesLoaded && !template) {
      navigate('/templates', { replace: true });
    }
  }, [isNew, templatesLoaded, template, navigate]);

  if (!isNew && (!templatesLoaded || !template)) return <TemplateDetailSkeleton />;
  if (!activeBudget) return <TemplateDetailSkeleton />;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await addTemplate({
          id: generateId(),
          name: templateName.trim() || t('templates.untitled'),
          workItems: activeBudget.workItems,
          adjustment: activeBudget.adjustment,
          catalogId: activeBudget.catalogId,
          createdAt: new Date().toISOString(),
        });
      } else {
        await updateTemplate({
          ...template!,
          name: templateName.trim() || template!.name,
          workItems: activeBudget.workItems,
          adjustment: activeBudget.adjustment,
          catalogId: activeBudget.catalogId,
        });
      }
      navigate('/templates');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    await removeTemplate(template.id);
    setShowDeleteConfirm(false);
    navigate('/templates', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-5xl mx-auto sm:py-8 sm:px-6">
        <button
          onClick={() => navigate('/templates')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 px-4 pt-4 sm:px-0 sm:pt-0 cursor-pointer"
        >
          <ArrowLeft size={14} />
          {t('templates.backToTemplates')}
        </button>

        <Card className="p-4 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isNew ? t('templates.newTitle') : t('templates.detailTitle')}
          </h1>

          <div className="max-w-sm mb-6">
            <Input
              id="templateName"
              label={t('templates.nameLabel')}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('templates.namePlaceholder')}
            />
          </div>

          <button
            onClick={togglePartidas}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer mb-3 px-2 py-1.5 -ml-2 rounded hover:bg-gray-50 uppercase"
            aria-expanded={showPartidas}
          >
            {showPartidas ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {t('budget.workItems')}
          </button>

          <div className={`collapsible ${showPartidas ? 'open' : ''}`}>
            <div>
              <BudgetEditor />
              <div className="mt-4 flex items-center gap-3">
                <AddWorkItemButton />
              </div>
            </div>
          </div>

          <BudgetSummary />

          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              {!isNew && (
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={16} />
                  {t('common.delete')}
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className={isNew ? 'ml-auto' : ''}>
                <Save size={16} />
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('templates.deleteConfirmTitle')}
        message={t('templates.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function TemplateDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-5xl mx-auto sm:py-8 sm:px-6">
        <Skeleton className="h-4 w-32 mb-4 mx-4 mt-4 sm:mx-0 sm:mt-0" />
        <Card className="p-4 sm:p-8 space-y-6">
          <Skeleton className="h-7 w-48" />
          <div className="max-w-sm space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-5 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}
