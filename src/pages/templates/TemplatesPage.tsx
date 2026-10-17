import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, LayoutTemplate, Plus } from 'lucide-react';
import { useTemplateStore } from '@/entities/template';
import { Button, ConfirmModal, Skeleton, PageHeader, SwipeActions } from '@/shared/ui';
import type { SwipeDirection } from '@/shared/ui';
import { withTimeout } from '@/shared/model/session';
import { t } from '@/shared/i18n';

export function TemplatesPage() {
  const templates = useTemplateStore((s) => s.templates);
  const loaded = useTemplateStore((s) => s.loaded);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState<{ id: string; direction: SwipeDirection } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!templateToDelete) return;
    await withTimeout(removeTemplate(templateToDelete));
    setTemplateToDelete(null);
  };

  return (
    <div className="page-container">
      <div className="template-library">
        <PageHeader
          title={t('templates.title')}
          description="Guarda las partidas que reutilizas en tus presupuestos."
          actions={
            <Button
              className="page-create-button"
              data-tour="template-create"
              aria-label="Crear plantilla"
              onClick={() => navigate('/templates/new')}
            >
              <Plus size={16} />
              <span className="page-create-label">Crear plantilla</span>
            </Button>
          }
        />

        {!loaded ? (
          <div className="space-y-3" role="status" aria-label="Cargando plantillas">
            <span className="sr-only">Cargando plantillas</span>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4"
              >
                <Skeleton className="h-10 w-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <LayoutTemplate size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">{t('templates.noTemplates')}</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">{t('templates.noTemplatesHint')}</p>
            <Button onClick={() => navigate('/templates/new')}>
              <Plus size={16} />
              Crear plantilla
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <SwipeActions
                key={tpl.id}
                label={tpl.name}
                openDirection={revealed?.id === tpl.id ? revealed.direction : null}
                onReveal={(direction) => setRevealed(direction ? { id: tpl.id, direction } : null)}
                actions={[
                  { id: 'delete', label: 'Eliminar', onAction: () => setTemplateToDelete(tpl.id) },
                ]}
              >
                <Link to={`/templates/${tpl.id}`} className="template-list-row">
                  <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {t('templates.workItems', { count: tpl.workItems.length })}
                    </p>
                  </div>
                </Link>
              </SwipeActions>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        title={t('templates.deleteConfirmTitle')}
        message={t('templates.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
      />
    </div>
  );
}
