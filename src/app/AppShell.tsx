import { useState, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  FileText,
  BookOpen,
  LayoutTemplate,
  Building2,
  CircleUserRound,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  CircleHelp,
} from 'lucide-react';
import { Brand } from '@/shared/ui/Brand';
import { ConfirmModal, Modal, CompanyAvatar } from '@/shared/ui';
import { useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import { useUserStore } from '@/entities/user';
import { PwaInstallBanner } from './PwaInstallBanner';
import { SyncStatus } from './SyncStatus';
import { AppTourProvider } from '@/features/app-tour/AppTour';
const links = [
  ['/budgets', 'Presupuestos', FileText],
  ['/templates', 'Plantillas', LayoutTemplate],
  ['/catalog', 'Catálogo', BookOpen],
  ['/profile', 'Mi empresa', Building2],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDetailPage =
    /^\/(?:budget|catalogs|templates)\/[^/]+\/?$/.test(location.pathname) ||
    location.pathname === '/account/password';
  const activePath = links.find(
    ([path]) =>
      location.pathname === path ||
      location.pathname.startsWith(path + '/') ||
      (path === '/budgets' && location.pathname.startsWith('/budget/')),
  )?.[0];
  useLayoutEffect(() => {
    if (links.some(([path]) => path === location.pathname)) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname]);
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
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
  return (
    <AppTourProvider userId={userId}>
      <div className={`app-shell${isDetailPage ? ' app-shell-detail' : ''}`}>
        <a className="skip-link" href="#workspace-content">
          Saltar al contenido
        </a>
        <aside className="sidebar no-print">
          <Link to="/budgets" aria-label="budgenerator, ir a presupuestos">
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
          <div className="sidebar-bottom">
            <NavLink className="nav-item" to="/help">
              <CircleHelp size={18} />
              Ayuda y guía
            </NavLink>
            {account?.accountData.isAdmin && (
              <NavLink className="nav-item" to="/admin">
                <ShieldCheck size={18} />
                Administración
              </NavLink>
            )}
            <NavLink className="nav-item" to="/account">
              <CircleUserRound size={18} />
              Mi cuenta
              <ArrowUpRight size={14} className="ml-auto" />
            </NavLink>
            <button className="nav-item w-full" onClick={() => setLogout(true)}>
              <LogOut size={18} />
              Cerrar sesión
            </button>
            <p className="sidebar-edition">BUDGENERATOR</p>
          </div>
        </aside>
        <div className="workspace">
          <header className="workspace-header no-print">
            <Link className="mobile-brand" to="/budgets" aria-label="budgenerator, inicio">
              <Brand />
            </Link>
            <span className="desktop-greeting">
              {links.find(([path]) => path === activePath)?.[1] ??
                (location.pathname.startsWith('/account')
                  ? 'Mi cuenta'
                  : location.pathname === '/help'
                    ? 'Ayuda y guía'
                    : 'Administración')}
            </span>
            <div className="workspace-actions">
              {!isDetailPage && <SyncStatus />}
              <button
                className="account-chip mobile-account-chip"
                onClick={() => setMenu(true)}
                aria-label="Abrir menú de cuenta"
              >
                <CompanyAvatar name={company.name} logo={company.logo} />
                <span className="account-chip-text">
                  {account?.accountData.plan === 'premium' ? 'Espacio Pro' : 'Mi espacio'}
                </span>
              </button>
            </div>
          </header>
          {isDetailPage && (
            <div className="detail-sync no-print">
              <SyncStatus />
            </div>
          )}
          <PwaInstallBanner />
          <main id="workspace-content">{children}</main>
        </div>
        {!isDetailPage && (
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
        <Modal open={menu} onClose={() => setMenu(false)} title="Mi cuenta">
          <Link className="nav-item" to="/help" onClick={() => setMenu(false)}>
            <CircleHelp size={18} />
            Ayuda y guía
          </Link>
          <Link className="nav-item" to="/account" onClick={() => setMenu(false)}>
            <CircleUserRound size={18} />
            Mi cuenta
          </Link>
          {account?.accountData.isAdmin && (
            <Link className="nav-item" to="/admin" onClick={() => setMenu(false)}>
              <ShieldCheck size={18} />
              Administración
            </Link>
          )}
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
        </Modal>
        <ConfirmModal
          open={logout}
          onClose={() => setLogout(false)}
          title="¿Cerramos por hoy?"
          message="Guardaremos los cambios pendientes antes de cerrar tu sesión."
          confirmLabel="Cerrar sesión"
          onConfirm={signOut}
        />
      </div>
    </AppTourProvider>
  );
}
