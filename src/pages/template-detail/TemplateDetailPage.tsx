import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useBudgetStore, useActiveBudget } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { BudgetEditor } from '@/features/budget-editor/ui/BudgetEditor';
import { AddWorkItemButton } from '@/features/budget-editor/ui/AddWorkItemButton';
import { BudgetSummary } from '@/features/budget-editor/ui/BudgetSummary';
import {
  Button,
  Card,
  ConfirmModal,
  Input,
  Skeleton,
  PageHeader,
  PageHeaderSkeleton,
} from '@/shared/ui';
import { generateId } from '@/shared/lib';
import type { BudgetTemplate } from '@/shared/types';
import { t } from '@/shared/i18n';

export function TemplateDetailPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>();
  const template = useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  return <TemplateEditor key={templateId} templateId={templateId} template={template ?? null} />;
}
function TemplateEditor({
  templateId,
  template,
}: {
  templateId: string;
  template: BudgetTemplate | null;
}) {
  const navigate = useNavigate();
  const isNew = templateId === 'new';

  const templatesLoaded = useTemplateStore((s) => s.loaded);
  const addTemplate = useTemplateStore((s) => s.addTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);

  const loadTemplateForEditing = useBudgetStore((s) => s.loadTemplateForEditing);
  const discardDraft = useBudgetStore((s) => s.discardDraft);
  const activeBudget = useActiveBudget();

  const updateInfo = useBudgetStore((s) => s.updateInfo);
  const templateName = activeBudget?.info.clientName ?? '';
  const [saveError, setSaveError] = useState('');
  const [initialTemplate] = useState<BudgetTemplate>(
    () => template ?? { id: '', name: '', workItems: [], createdAt: '' },
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const newTemplateId = useRef(generateId());

  const partidasKey = `collapsed-partidas-template-${templateId ?? ''}`;
  const [showPartidas, setShowPartidas] = useState(() => {
    try {
      const stored = localStorage.getItem(partidasKey);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const togglePartidas = () =>
    setShowPartidas((prev) => {
      localStorage.setItem(partidasKey, String(!prev));
      return !prev;
    });

  useEffect(() => {
    loadTemplateForEditing(initialTemplate);
    return () => {
      useBudgetStore.setState({ draftBudget: null, draftKey: null, draftDirty: false });
    };
  }, [initialTemplate, loadTemplateForEditing]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      useBudgetStore.getState().draftDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isNew && templatesLoaded && !template) {
      discardDraft();
      navigate('/templates', { replace: true });
    }
  }, [isNew, templatesLoaded, template, navigate, discardDraft]);

  if (!isNew && (!templatesLoaded || !template)) return <TemplateDetailSkeleton />;
  if (!activeBudget) return <TemplateDetailSkeleton />;

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      if (isNew) {
        await addTemplate({
          id: newTemplateId.current,
          name: templateName.trim() || t('templates.untitled'),
          workItems: activeBudget.workItems,
          adjustment: activeBudget.adjustment,
          catalogId: activeBudget.catalogId,
          ivaRate: activeBudget.ivaRate,
          createdAt: new Date().toISOString(),
        });
      } else {
        await updateTemplate({
          ...template!,
          name: templateName.trim() || template!.name,
          workItems: activeBudget.workItems,
          adjustment: activeBudget.adjustment,
          catalogId: activeBudget.catalogId,
          ivaRate: activeBudget.ivaRate,
        });
      }
      discardDraft();
      navigate('/templates');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se ha podido guardar la plantilla.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    await removeTemplate(template.id);
    setShowDeleteConfirm(false);
    discardDraft();
    navigate('/templates', { replace: true });
  };

  return (
    <div className="page-container">
      <div className="template-document-content">
        <PageHeader
          title={isNew ? t('templates.newTitle') : t('templates.detailTitle')}
          description="Define las partidas que reutilizarás en tus presupuestos."
          backTo="/templates"
          backLabel={t('templates.backToTemplates')}
        />

        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
        <fieldset disabled={saving} className="min-w-0">
          <Card className="p-4 sm:p-8">
            <div className="max-w-sm mb-6">
              <Input
                id="templateName"
                label={t('templates.nameLabel')}
                value={templateName}
                onChange={(e) => updateInfo({ clientName: e.target.value })}
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
                <Button onClick={handleSave} loading={saving} className={isNew ? 'ml-auto' : ''}>
                  <Save size={16} />
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </Card>
        </fieldset>
      </div>

      <ConfirmModal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        title="¿Salimos de la plantilla?"
        message="Tienes cambios sin guardar. Puedes seguir editando o descartarlos."
        confirmLabel="Descartar cambios"
        onConfirm={() => {
          if (blocker.state === 'blocked') {
            discardDraft();
            blocker.proceed();
          }
        }}
      />
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
    <div className="page-container">
      <div className="template-document-content">
        <PageHeaderSkeleton />
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
