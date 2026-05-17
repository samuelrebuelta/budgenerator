import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, LayoutTemplate, Plus } from 'lucide-react';
import { useTemplateStore } from '@/entities/template';
import { Button, ConfirmModal } from '@/shared/ui';
import { t } from '@/shared/i18n';

export function TemplatesPage() {
  const templates = useTemplateStore((s) => s.templates);
  const loaded = useTemplateStore((s) => s.loaded);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const navigate = useNavigate();
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!templateToDelete) return;
    await removeTemplate(templateToDelete);
    setTemplateToDelete(null);
  };

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

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('templates.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {!loaded
                ? '\u00A0'
                : templates.length === 0
                  ? t('templates.noTemplates')
                  : t('templates.count', { count: templates.length })}
            </p>
          </div>
          <Button onClick={() => navigate('/templates/new')}>
            <Plus size={16} />
            <span className="hidden sm:inline">{t('templates.newTemplate')}</span>
          </Button>
        </div>

        {loaded && templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <LayoutTemplate size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">{t('templates.noTemplates')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('templates.noTemplatesHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => navigate(`/templates/${tpl.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p className="font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {t('templates.workItems', { count: tpl.workItems.length })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setTemplateToDelete(tpl.id); }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
