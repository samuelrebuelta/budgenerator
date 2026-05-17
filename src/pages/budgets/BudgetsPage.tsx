import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, BookOpen, LogOut, Building2, Trash2, Sparkles, ShieldCheck, User, CircleUserRound, LayoutTemplate } from 'lucide-react';
import { useBudgetStore } from '@/entities/budget';
import { useTemplateStore } from '@/entities/template';
import { useAuthStore } from '@/entities/auth';
import { useUserStore } from '@/entities/user';
import { formatCurrency, CONTACT_EMAIL } from '@/shared/lib';
import { Button, BudgetLimitReached, ConfirmModal, Modal } from '@/shared/ui';
import { BudgetsSkeleton } from './components/BudgetsSkeleton';
import { t } from '@/shared/i18n';

export function BudgetsPage() {
  const budgets = useBudgetStore((s) => s.budgets);
  const loaded = useBudgetStore((s) => s.loaded);
  const getBudgetTotal = useBudgetStore((s) => s.getBudgetTotal);
  const startDraftFromTemplate = useBudgetStore((s) => s.startDraftFromTemplate);
  const templates = useTemplateStore((s) => s.templates);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const signOut = useAuthStore((s) => s.signOut);
  const canCreateBudget = useUserStore((s) => s.canCreateBudget);
  const userData = useUserStore((s) => s.userData);
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleCreate = () => {
    if (!canCreateBudget()) {
      setShowLimitReached(true);
      return;
    }
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

        {userData?.accountData.isAdmin && (
          <div
            onClick={() => navigate('/admin')}
            className="mb-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors"
          >
            <ShieldCheck size={18} className="text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 font-medium flex-1">{t('budgetList.adminBanner')}</p>
            <span className="text-blue-400 text-sm">&rarr;</span>
          </div>
        )}

        {userData?.accountData.plan === 'free' && (
          <div className="mb-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <Sparkles size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{t('budgetList.upgradeBannerTitle')}</span>{' '}
              {t('budgetList.upgradeBannerMessage', { email: CONTACT_EMAIL }).split(CONTACT_EMAIL)[0]}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-amber-700 underline hover:text-amber-900"
              >
                {CONTACT_EMAIL}
              </a>
              {t('budgetList.upgradeBannerMessage', { email: CONTACT_EMAIL }).split(CONTACT_EMAIL)[1]}
            </p>
          </div>
        )}

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
            <Button onClick={handleCreate}>
              <Plus size={16} />
              <span className="hidden sm:inline">{t('budgetList.newBudget')}</span>
            </Button>
            <div className="relative" ref={menuRef}>
              <Button variant="secondary" onClick={() => setShowMenu(!showMenu)} title={t('settings.title')}>
                <User size={16} />
              </Button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { setShowMenu(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <Building2 size={16} className="text-gray-400" />
                    {t('profile.title')}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); navigate('/catalogs'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <BookOpen size={16} className="text-gray-400" />
                    {t('budgetList.catalog')}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); navigate('/templates'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <LayoutTemplate size={16} className="text-gray-400" />
                    {t('templates.title')}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); navigate('/account'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <CircleUserRound size={16} className="text-gray-400" />
                    {t('account.title')}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setShowMenu(false); setShowLogout(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <LogOut size={16} className="text-red-400" />
                    {t('budgetList.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!loaded ? (
          <BudgetsSkeleton />
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

      <ConfirmModal
        open={showLogout}
        onClose={() => setShowLogout(false)}
        title={t('budgetList.logoutConfirmTitle')}
        message={t('budgetList.logoutConfirmMessage')}
        confirmLabel={t('budgetList.signOut')}
        onConfirm={signOut}
      />

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

      <ConfirmModal
        open={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        title={t('templates.deleteConfirmTitle')}
        message={t('templates.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDeleteTemplate}
      />

      <Modal open={showLimitReached} onClose={() => setShowLimitReached(false)}>
        <BudgetLimitReached totalBudgetsCreated={userData?.totalBudgetsCreated ?? 0} />
        <div className="flex justify-center mt-6">
          <Button variant="secondary" onClick={() => setShowLimitReached(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
