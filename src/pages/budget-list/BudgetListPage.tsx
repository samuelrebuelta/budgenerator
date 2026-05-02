import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Settings, LogOut, Building2, Trash2 } from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { useAuthStore } from '@/entities/auth';
import { formatCurrency } from '@/shared/lib';
import { Button, Modal } from '@/shared/ui';
import { BudgetListSkeleton } from './components/BudgetListSkeleton';
import { t } from '@/shared/i18n';

export function BudgetListPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const loaded = useBudgetStore((s) => s.loaded);
  const getBudgetTotal = useBudgetStore((s) => s.getBudgetTotal);
  const startDraftFromTemplate = useBudgetStore((s) => s.startDraftFromTemplate);
  const templates = useTemplateStore((s) => s.templates);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleCreate = () => {
    if (templates.length > 0) {
      setShowTemplates(true);
    } else {
      navigate('/budget/new');
    }
  };

  const handleBlank = () => {
    setShowTemplates(false);
    navigate('/budget/new');
  };

  const handleFromTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    startDraftFromTemplate(tpl);
    setShowTemplates(false);
    navigate('/budget/new');
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    await removeTemplate(templateToDelete);
    setTemplateToDelete(null);
  };

  const handleOpen = (id: string) => {
    navigate(`/budget/${id}`);
  };

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('budgetList.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {!loaded
                ? '\u00A0'
                : budgets.length === 0
                  ? t('budgetList.empty')
                  : t('budgetList.count', { count: budgets.length })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={() => setShowLogout(true)} title={t('budgetList.signOut')}>
              <LogOut size={16} />
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')} title={t('profile.title')}>
              <Building2 size={16} />
              <span className="hidden sm:inline">{t('budgetList.company')}</span>
            </Button>
            <Button variant="secondary" onClick={() => navigate('/catalog')}>
              <Settings size={16} />
              <span className="hidden sm:inline">{t('budgetList.catalog')}</span>
            </Button>
            <Button onClick={handleCreate}>
              <Plus size={16} />
              <span className="hidden sm:inline">{t('budgetList.newBudget')}</span>
            </Button>
          </div>
        </div>

        {!loaded ? (
          <BudgetListSkeleton />
        ) : budgets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">{t('budgetList.emptyTitle')}</p>
            <p className="text-sm text-gray-400 mt-1">
              {t('budgetList.emptySubtitle')}
            </p>
            <Button onClick={handleCreate} className="mt-6">
              <Plus size={16} />
              {t('budgetList.createBudget')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {[...budgets].reverse().map((budget) => {
              const total = getBudgetTotal(budget.id);
              const date = budget.info.date
                ? new Date(budget.info.date).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';

              return (
                <div
                  key={budget.id}
                  onClick={() => handleOpen(budget.id)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="font-semibold text-gray-900 truncate">
                        {budget.info.clientName || t('budgetList.noName')}
                      </p>
                      {budget.info.address && (
                        <p className="text-xs text-gray-400 truncate overflow-hidden text-ellipsis whitespace-nowrap">{budget.info.address}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        {budget.info.budgetNumber && (
                          <span>{t('budgetList.budgetNumber', { 0: budget.info.budgetNumber })}</span>
                        )}
                        <span>{date}</span>
                        <span>{t('budgetList.workItems', { count: budget.workItems.length })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showLogout} onClose={() => setShowLogout(false)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('budgetList.logoutConfirmTitle')}</h3>
        <p className="text-sm text-gray-600 mb-6">{t('budgetList.logoutConfirmMessage')}</p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowLogout(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={signOut}>
            {t('budgetList.signOut')}
          </Button>
        </div>
      </Modal>

      <Modal open={showTemplates} onClose={() => setShowTemplates(false)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('templates.loadTemplate')}</h3>
        <div className="space-y-2 mb-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:border-blue-300 cursor-pointer transition-colors"
              onClick={() => handleFromTemplate(tpl.id)}
            >
              <div>
                <p className="font-medium text-gray-900">{tpl.name}</p>
                <p className="text-xs text-gray-500">{t('templates.workItems', { count: tpl.workItems.length })}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setTemplateToDelete(tpl.id); }}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button onClick={handleBlank} className="w-full">
          <Plus size={16} />
          {t('budgetList.newBudget')}
        </Button>
      </Modal>

      <Modal open={!!templateToDelete} onClose={() => setTemplateToDelete(null)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('templates.deleteConfirmTitle')}</h3>
        <p className="text-sm text-gray-600 mb-6">{t('templates.deleteConfirmMessage')}</p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => setTemplateToDelete(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDeleteTemplate}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
