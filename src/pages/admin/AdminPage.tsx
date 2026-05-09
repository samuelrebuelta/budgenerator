import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Crown } from 'lucide-react';
import { useUserStore } from '@/entities/user';
import { Button, Modal } from '@/shared/ui';
import { Skeleton } from '@/shared/ui';
import type { UserData } from '@/shared/types';
import { t } from '@/shared/i18n';

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const date = new Date(iso).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminPage() {
  const allUsers = useUserStore((s) => s.allUsers);
  const visibleUsers = allUsers.filter((u) => !u.accountData.isAdmin);
  const allUsersLoaded = useUserStore((s) => s.allUsersLoaded);
  const loadAllUsers = useUserStore((s) => s.loadAllUsers);
  const setUserPlan = useUserStore((s) => s.setUserPlan);
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  const handleTogglePlan = async (user: UserData) => {
    setSaving(true);
    const newPlan = user.accountData.plan === 'premium' ? 'free' : 'premium';
    await setUserPlan(user.uid, newPlan);
    setSelectedUser({ ...user, accountData: { ...user.accountData, plan: newPlan } });
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-white sm:bg-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <ArrowLeft size={14} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} />
              {t('admin.title')}
            </h1>
          </div>
        </div>

        {allUsersLoaded && (
          <p className="text-sm text-gray-500 mb-4">
            {t('admin.userCount', { count: visibleUsers.length })}
          </p>
        )}

        {!allUsersLoaded ? (
          <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 p-4 sm:p-6 space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 overflow-hidden">
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('admin.email')}</th>
                    <th className="px-4 py-3 text-center">{t('admin.plan')}</th>
                    <th className="px-4 py-3 text-center">{t('admin.budgetsCreated')}</th>
                    <th className="px-4 py-3 text-right">{t('admin.registeredAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 border-b border-gray-200">
                  {visibleUsers.map((user) => (
                    <tr
                      key={user.uid}
                      onClick={() => setSelectedUser(user)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-left font-medium text-blue-700">{user.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.accountData.plan === 'premium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {user.accountData.plan === 'premium' && <Crown size={12} />}
                          {user.accountData.plan === 'premium' ? t('admin.premium') : t('admin.free')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{user.totalBudgetsCreated}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {formatRelativeDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleUsers.length === 0 && (
              <p className="text-center text-gray-400 py-8">{t('admin.noUsers')}</p>
            )}
          </div>
        )}
      </div>

      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)}>
        {selectedUser && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.userDetail')}</h3>
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs text-gray-500 uppercase">{t('admin.email')}</span>
                <p className="text-sm font-medium text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">{t('admin.budgetsCreated')}</span>
                <p className="text-sm font-medium text-gray-900">{selectedUser.totalBudgetsCreated}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">{t('admin.registeredAt')}</span>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedUser.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div>
                  <span className="text-xs text-gray-500 uppercase">{t('admin.premiumPlan')}</span>
                  <p className="text-sm text-gray-600">{t('admin.premiumDescription')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUser.accountData.plan === 'premium'}
                    onChange={() => handleTogglePlan(selectedUser)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
