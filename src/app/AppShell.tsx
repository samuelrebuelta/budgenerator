import { useState, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, LogOut } from 'lucide-react';
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
import {
  ACCOUNT_LINKS,
  ADMIN_LINK,
  activeTabFor,
  COMPANY_LINKS,
  isPrimaryTab,
  PRIMARY_TABS,
  sectionTitle,
  type NavigationLink,
} from './navigation';

function MenuLink({
  link,
  state,
  onNavigate,
}: {
  link: NavigationLink;
  state?: { returnTab: string };
  onNavigate: () => void;
}) {
  const Icon = link.icon;
  return (
    <PageLink className="nav-item" to={link.to} state={state} onClick={onNavigate}>
      <Icon size={18} aria-hidden="true" />
      {link.label}
    </PageLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isCatalogPage = location.pathname.replace(/\/+$/, '') === '/catalog';
  const activePath = activeTabFor(location.pathname);
  const menuReturnTab = activePath ?? getPageReturnTab(location.state);
  const menuNavigationState = menuReturnTab ? { returnTab: menuReturnTab } : undefined;
  const isPrimaryTabPage = isPrimaryTab(location.pathname);
  const showMobileNav = isPrimaryTabPage;
  const isSecondaryPage = !isPrimaryTabPage;
  useLayoutEffect(() => {
    if (
      PRIMARY_TABS.some(({ to }) => to === location.pathname) ||
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
  const isAdmin = useAuthStore((s) => s.isAdmin);
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
            {PRIMARY_TABS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`nav-item ${to === activePath ? 'active' : ''}`}
                aria-current={to === activePath ? 'page' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {isAdmin && (
            <div className="sidebar-admin">
              <PageLink
                className="nav-item"
                to="/admin"
                aria-current={location.pathname === '/admin' ? 'page' : undefined}
              >
                <ADMIN_LINK.icon size={18} aria-hidden="true" />
                {ADMIN_LINK.label}
              </PageLink>
            </div>
          )}
          <div className="sidebar-bottom">
            {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
              <PageLink
                key={to}
                className="nav-item"
                to={to}
                aria-current={
                  location.pathname === to || location.pathname.startsWith(`${to}/`)
                    ? 'page'
                    : undefined
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
                {to === '/account' && (
                  <ArrowUpRight size={14} className="ml-auto" aria-hidden="true" />
                )}
              </PageLink>
            ))}
            <button type="button" className="nav-item w-full" onClick={() => setLogout(true)}>
              <LogOut size={18} aria-hidden="true" />
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
            <span className="desktop-greeting">{sectionTitle(location.pathname)}</span>
            <div className="workspace-actions">
              <SyncStatus />
              <button
                type="button"
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
            {PRIMARY_TABS.map(({ to: path, label, icon: Icon }) => (
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
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}
        <Modal open={menu} onClose={() => setMenu(false)} title="Menú de cuenta">
          {isAdmin && (
            <section className="account-menu-section" aria-label="Administración">
              <h2 className="account-menu-heading">Administración</h2>
              <MenuLink
                link={ADMIN_LINK}
                state={menuNavigationState}
                onNavigate={() => setMenu(false)}
              />
            </section>
          )}
          <section className="account-menu-section" aria-label="Empresa y herramientas">
            <h2 className="account-menu-heading">Empresa y herramientas</h2>
            {COMPANY_LINKS.map((link) => (
              <MenuLink
                key={link.to}
                link={link}
                state={menuNavigationState}
                onNavigate={() => setMenu(false)}
              />
            ))}
          </section>
          <section className="account-menu-section" aria-label="Gestión de cuenta y ayuda">
            <h2 className="account-menu-heading">Gestión de cuenta y ayuda</h2>
            {ACCOUNT_LINKS.map((link) => (
              <MenuLink
                key={link.to}
                link={link}
                state={menuNavigationState}
                onNavigate={() => setMenu(false)}
              />
            ))}
            <button
              type="button"
              className="nav-item w-full"
              onClick={() => {
                setMenu(false);
                setLogout(true);
              }}
            >
              <LogOut size={18} aria-hidden="true" />
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
