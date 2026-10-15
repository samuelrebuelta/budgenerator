import { useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import { Brand } from '@/shared/ui/Brand';
import { ConfirmModal, Modal } from '@/shared/ui';
import { useAuthStore } from '@/entities/auth';
import { useUserStore } from '@/entities/user';
import { SyncStatus } from './SyncStatus';
const links = [
  ['/budgets', 'Presupuestos', FileText],
  ['/catalogs', 'Catálogos', BookOpen],
  ['/templates', 'Plantillas', LayoutTemplate],
  ['/profile', 'Mi empresa', Building2],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activePath = links.find(
    ([path]) =>
      location.pathname === path ||
      location.pathname.startsWith(path + '/') ||
      (path === '/budgets' && location.pathname.startsWith('/budget/')),
  )?.[0];
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const account = useUserStore((s) => s.userData);
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <div className="app-shell">
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
              (location.pathname.startsWith('/account') ? 'Mi cuenta' : 'Administración')}
          </span>
          <div className="workspace-actions">
            <SyncStatus />
            <button
              className="account-chip mobile-account-chip"
              onClick={() => setMenu(true)}
              aria-label="Abrir menú de cuenta"
            >
              <span>B</span>
              <span className="account-chip-text">
                {account?.accountData.plan === 'premium' ? 'Espacio Pro' : 'Mi espacio'}
              </span>
            </button>
          </div>
        </header>
        <main id="workspace-content">{children}</main>
        <footer className="workspace-footer no-print">
          budgenerator © {new Date().getFullYear()}
        </footer>
      </div>
      <nav className="mobile-nav no-print" aria-label="Navegación móvil">
        {links.map(([path, label, Icon]) => (
          <Link
            key={path}
            to={path}
            className={path === activePath ? 'active' : undefined}
            aria-current={path === activePath ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Modal open={menu} onClose={() => setMenu(false)} title="Mi cuenta">
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
  );
}
