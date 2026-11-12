import { useState, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  BookOpen,
  LayoutTemplate,
  Building2,
  UsersRound,
  Inbox,
  Calculator,
  CircleUserRound,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  CircleHelp,
  Briefcase,
} from 'lucide-react';
import { Brand } from '@/shared/ui/Brand';
import {
  ConfirmModal,
  Modal,
  CompanyAvatar,
  PageHeaderAccessoryProvider,
  PageLink,
} from '@/shared/ui';
import { useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import { useUserStore } from '@/entities/user';
import { PwaInstallBanner } from './PwaInstallBanner';
import { SyncStatus } from './SyncStatus';
import { AppTourProvider } from '@/features/app-tour/AppTour';
import { ForegroundNotificationHost, PushStartupPrompt } from '@/features/notifications';
import { getPageReturnTab } from '@/shared/ui/page-view-transition';
import {
  completeCurrentDeviceSignOut,
  revokeCurrentDeviceBeforeSignOut,
} from '@/features/notifications/model/push';
const links = [
  ['/budgets', 'Presupuestos', FileText],
  ['/projects', 'Proyectos', Briefcase],
  ['/team', 'Equipo', UsersRound],
  ['/profile/solicitudes', 'Solicitudes', Inbox],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isCatalogPage = location.pathname.replace(/\/+$/, '') === '/catalog';
  const activePath = links.find(
    ([path]) =>
      location.pathname === path ||
      location.pathname.startsWith(path + '/') ||
      (path === '/budgets' && location.pathname.startsWith('/budget/')),
  )?.[0];
  const menuReturnTab = activePath ?? getPageReturnTab(location.state);
  const menuNavigationState = menuReturnTab ? { returnTab: menuReturnTab } : undefined;
  const isPrimaryTabPage = links.some(([path]) => location.pathname.replace(/\/+$/, '') === path);
  const showMobileNav = isPrimaryTabPage;
  const isSecondaryPage = !isPrimaryTabPage;
  useLayoutEffect(() => {
    if (
      links.some(([path]) => path === location.pathname) ||
      isCatalogPage ||
      location.pathname === '/estimator'
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [isCatalogPage, location.pathname]);
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const [mobileBackTarget, setMobileBackTarget] = useState<HTMLDivElement | null>(null);
  const [workspaceHeaderActionTarget, setWorkspaceHeaderActionTarget] =
    useState<HTMLDivElement | null>(null);
  const company = useProfileStore((s) => s.profile);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let baseline = viewport.height;
    const update = () => {
      const editing =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches('input, textarea, [contenteditable="true"]');
      if (!editing) baseline = viewport.height;
      setKeyboardOpen(
        editing && (baseline - viewport.height > 120 || window.innerHeight - viewport.height > 120),
      );
    };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  const account = useUserStore((s) => s.userData);
  const userId = useAuthStore((s) => s.user?.uid);
  const signOut = useAuthStore((s) => s.signOut);
  const handleSignOut = async () => {
    const installationId = userId ? await revokeCurrentDeviceBeforeSignOut(userId) : null;
    try {
      await signOut();
    } finally {
      if (installationId) completeCurrentDeviceSignOut(installationId);
    }
  };
  return (
    <AppTourProvider userId={userId}>
      <ForegroundNotificationHost />
      <div className={`app-shell${isSecondaryPage ? ' app-shell-secondary' : ''}`}>
        <a className="skip-link" href="#workspace-content">
          Saltar al contenido
        </a>
        <aside className="sidebar no-print">
          <Link to="/projects" aria-label="budgenerator, ir a proyectos">
            <Brand />
          </Link>
          <p className="nav-caption">NAVEGACIÓN</p>
          <nav aria-label="Navegación principal">
            {links.map(([path, label, Icon]) => (
              <Link
                key={path}
                to={path}
                className={`nav-item ${path === activePath ? 'active' : ''}`}
                aria-current={path === activePath ? 'page' : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {account?.accountData.isAdmin && (
            <div className="sidebar-admin">
              <PageLink
                className="nav-item"
                to="/admin"
                aria-current={location.pathname === '/admin' ? 'page' : undefined}
              >
                <ShieldCheck size={18} />
                Panel de administración
              </PageLink>
            </div>
          )}
          <div className="sidebar-bottom">
            <PageLink
              className="nav-item"
              to="/account"
              aria-current={location.pathname.startsWith('/account') ? 'page' : undefined}
            >
              <CircleUserRound size={18} />
              Mi cuenta
              <ArrowUpRight size={14} className="ml-auto" />
            </PageLink>
            <PageLink
              className="nav-item"
              to="/help"
              aria-current={location.pathname === '/help' ? 'page' : undefined}
            >
              <CircleHelp size={18} />
              Ayuda
            </PageLink>
            <button className="nav-item w-full" onClick={() => setLogout(true)}>
              <LogOut size={18} />
              Cerrar sesión
            </button>
            <p className="sidebar-edition">BUDGENERATOR</p>
          </div>
        </aside>
        <div className="workspace">
          <header className="workspace-header no-print">
            <div className="mobile-header-back-slot" ref={setMobileBackTarget} />
            <Link className="mobile-brand" to="/projects" aria-label="budgenerator, inicio">
              <Brand />
            </Link>
            <span className="desktop-greeting">
              {links.find(([path]) => path === activePath)?.[1] ??
                (location.pathname.startsWith('/account')
                  ? 'Mi cuenta'
                  : location.pathname.startsWith('/profile')
                    ? 'Mi empresa'
                    : isCatalogPage
                      ? 'Catálogo'
                      : location.pathname === '/help'
                        ? 'Ayuda'
                        : location.pathname.startsWith('/templates')
                          ? 'Plantillas de presupuestos'
                          : location.pathname.startsWith('/estimator')
                            ? 'Estimador público'
                            : location.pathname === '/team'
                              ? 'Equipo'
                              : location.pathname.startsWith('/admin')
                                ? 'Panel de administración'
                                : 'BudGenerator')}
            </span>
            <div className="workspace-actions">
              <SyncStatus />
              <button
                className="account-chip account-menu-trigger"
                onClick={() => setMenu(true)}
                aria-label="Abrir menú de cuenta"
              >
                <CompanyAvatar name={company.name} logo={company.logo} />
                <span className="account-chip-text">
                  {account?.accountData.plan === 'premium' ? 'Espacio Pro' : 'Mi espacio'}
                </span>
              </button>
              <div className="workspace-header-action-slot" ref={setWorkspaceHeaderActionTarget} />
            </div>
          </header>
          <PwaInstallBanner />
          <PushStartupPrompt />
          <main id="workspace-content">
            <PageHeaderAccessoryProvider
              mobileBackTarget={isSecondaryPage ? mobileBackTarget : null}
              workspaceHeaderActionTarget={workspaceHeaderActionTarget}
            >
              {children}
            </PageHeaderAccessoryProvider>
          </main>
        </div>
        {showMobileNav && (
          <nav
            className="mobile-nav no-print"
            aria-label="Navegación móvil"
            data-keyboard-open={keyboardOpen}
          >
            {links.map(([path, label, Icon]) => (
              <Link
                key={path}
                to={path}
                onClick={(event) => {
                  if (path !== location.pathname) return;
                  event.preventDefault();
                  window.scrollTo({
                    top: 0,
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  });
                }}
                className={path === activePath ? 'active' : undefined}
                aria-current={path === activePath ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}
        <Modal open={menu} onClose={() => setMenu(false)} title="Menú de cuenta">
          {account?.accountData.isAdmin && (
            <section className="account-menu-section" aria-label="Administración">
              <h2 className="account-menu-heading">Administración</h2>
              <PageLink
                className="nav-item"
                to="/admin"
                state={menuNavigationState}
                onClick={() => setMenu(false)}
              >
                <ShieldCheck size={18} />
                Panel de administración
              </PageLink>
            </section>
          )}
          <section className="account-menu-section" aria-label="Empresa y herramientas">
            <h2 className="account-menu-heading">Empresa y herramientas</h2>
            <PageLink
              className="nav-item"
              to="/profile"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <Building2 size={18} />
              Mi empresa
            </PageLink>
            <PageLink
              className="nav-item"
              to="/catalog"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <BookOpen size={18} />
              Catálogo
            </PageLink>
            <PageLink
              className="nav-item"
              to="/templates"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <LayoutTemplate size={18} />
              Plantillas de presupuestos
            </PageLink>
            <PageLink
              className="nav-item"
              to="/estimator"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <Calculator size={18} />
              Estimador público
            </PageLink>
          </section>
          <section className="account-menu-section" aria-label="Gestión de cuenta y ayuda">
            <h2 className="account-menu-heading">Gestión de cuenta y ayuda</h2>
            <PageLink
              className="nav-item"
              to="/account"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <CircleUserRound size={18} />
              Mi cuenta
            </PageLink>
            <PageLink
              className="nav-item"
              to="/help"
              state={menuNavigationState}
              onClick={() => setMenu(false)}
            >
              <CircleHelp size={18} />
              Ayuda
            </PageLink>
            <button
              className="nav-item w-full"
              onClick={() => {
                setMenu(false);
                setLogout(true);
              }}
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </section>
        </Modal>
        <ConfirmModal
          open={logout}
          onClose={() => setLogout(false)}
          title="¿Cerramos por hoy?"
          message="Guardaremos los cambios pendientes antes de cerrar tu sesión."
          confirmLabel="Cerrar sesión"
          onConfirm={handleSignOut}
        />
      </div>
    </AppTourProvider>
  );
}
