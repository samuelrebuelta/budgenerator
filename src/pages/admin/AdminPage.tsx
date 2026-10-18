import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { useUserStore } from '@/entities/user';
import { Button, Card, LoadingSpinner, Modal, PageHeader, Switch } from '@/shared/ui';
import { Skeleton } from '@/shared/ui';
import type { UserData, UserPlan } from '@/shared/types';
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
  const setPremiumExpiry = useUserStore((s) => s.setPremiumExpiry);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [error, setError] = useState('');
  const [savingAction, setSavingAction] = useState<'plan' | 'expiry' | null>(null);
  const saving = savingAction !== null;
  const [retryingUsers, setRetryingUsers] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');

  useEffect(() => {
    void loadAllUsers().catch(() => setError('No se han podido cargar los usuarios.'));
  }, [loadAllUsers]);

  const handleTogglePlan = async (user: UserData) => {
    setSavingAction('plan');
    const newPlan = (user.accountData.plan === 'premium' ? 'free' : 'premium') as UserPlan;
    const newExpiresAt =
      newPlan === 'premium'
        ? (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString();
          })()
        : undefined;
    try {
      await setUserPlan(user.uid, newPlan);
      const updated = {
        ...user,
        accountData: { ...user.accountData, plan: newPlan, premiumExpiresAt: newExpiresAt },
      };
      setSelectedUser(updated);
      setExpiryInput(newExpiresAt ? newExpiresAt.slice(0, 10) : '');
    } catch {
      setError('No se ha podido cambiar el plan.');
    } finally {
      setSavingAction(null);
    }
  };

  const handleExpiryChange = async (user: UserData, value: string) => {
    setExpiryInput(value);
    if (!value) return;
    const iso = new Date(value + 'T23:59:59.999Z').toISOString();
    setSavingAction('expiry');
    try {
      await setPremiumExpiry(user.uid, iso);
      setSelectedUser({ ...user, accountData: { ...user.accountData, premiumExpiresAt: iso } });
    } catch {
      setError('No se ha podido actualizar la fecha.');
    } finally {
      setSavingAction(null);
    }
  };

  const retryUsers = async () => {
    if (retryingUsers) return;
    setRetryingUsers(true);
    try {
      await loadAllUsers();
      setError('');
    } catch {
      setError('No se han podido cargar los usuarios.');
    } finally {
      setRetryingUsers(false);
    }
  };

  return (
    <div className="page-container">
      <div className="admin-content">
        {error && (
          <p className="field-error" role="alert">
            {error}{' '}
            <Button variant="ghost" loading={retryingUsers} onClick={() => void retryUsers()}>
              {retryingUsers ? 'Reintentando…' : 'Reintentar'}
            </Button>
          </p>
        )}
        <PageHeader
          title={t('admin.title')}
          description="Consulta las cuentas y gestiona sus permisos y planes."
          backTo="/projects"
          backLabel="Volver a proyectos"
        />
        {allUsersLoaded && (
          <p className="text-sm text-gray-500 mb-4">
            {t('admin.userCount', { count: visibleUsers.length })}
          </p>
        )}

        {!allUsersLoaded ? (
          <Card className="p-4 sm:p-6 space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </Card>
        ) : (
          <Card className="overflow-hidden">
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
                      onClick={() => {
                        setSelectedUser(user);
                        setExpiryInput(user.accountData.premiumExpiresAt?.slice(0, 10) ?? '');
                      }}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-left font-medium text-blue-700">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setExpiryInput(user.accountData.premiumExpiresAt?.slice(0, 10) ?? '');
                          }}
                        >
                          {user.email}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.accountData.plan === 'premium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {user.accountData.plan === 'premium' && <Crown size={12} />}
                          {user.accountData.plan === 'premium'
                            ? t('admin.premium')
                            : t('admin.free')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {user.totalBudgetsCreated}
                      </td>
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
          </Card>
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
                <p className="text-sm font-medium text-gray-900">
                  {selectedUser.totalBudgetsCreated}
                </p>
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
              <Switch
                label={t('admin.premiumPlan')}
                description={t('admin.premiumDescription')}
                checked={selectedUser.accountData.plan === 'premium'}
                onCheckedChange={() => void handleTogglePlan(selectedUser)}
                disabled={saving}
                loading={savingAction === 'plan'}
                className="border-t border-gray-200 pt-2"
              />
              {selectedUser.accountData.plan === 'premium' && (
                <div className="pt-2">
                  <span className="text-xs text-gray-500 uppercase">
                    {t('admin.premiumExpiresAt')}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="date"
                      value={expiryInput}
                      onChange={(e) => handleExpiryChange(selectedUser, e.target.value)}
                      disabled={saving}
                      aria-busy={savingAction === 'expiry' || undefined}
                      className="block w-full flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    {savingAction === 'expiry' && <LoadingSpinner size={15} />}
                  </div>
                  {selectedUser.accountData.premiumExpiresAt &&
                    new Date(selectedUser.accountData.premiumExpiresAt) < new Date() && (
                      <p className="text-xs text-red-500 mt-1">{t('admin.premiumExpired')}</p>
                    )}
                </div>
              )}
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
