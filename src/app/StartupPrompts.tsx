import { useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { PushStartupPrompt } from '@/features/notifications';
import { PwaInstallBanner } from './PwaInstallBanner';
import { pwaInstall } from './pwaInstall';

/** Pantallas de entrada: en las demás, el aviso estorba más de lo que ayuda. */
const HOME_ROUTES = new Set(['/budgets', '/projects']);

/**
 * Los dos avisos de arranque juntos ocupaban media pantalla del móvil, y en todas las
 * páginas. Aquí se muestra como mucho uno, y solo al llegar a una pantalla de entrada.
 *
 * Primero el de los avisos push, porque sin ellos el titular no se entera de que ha
 * llegado una solicitud; instalar la app solo es comodidad y puede esperar su turno.
 */
export function StartupPrompts() {
  const { pathname } = useLocation();
  const install = useSyncExternalStore(pwaInstall.subscribe, pwaInstall.getSnapshot);
  const [pushVisible, setPushVisible] = useState(false);
  if (!HOME_ROUTES.has(pathname)) return null;
  const offersInstall = !(install.standalone || install.installed || install.dismissed);
  return (
    <>
      <PushStartupPrompt onVisibilityChange={setPushVisible} />
      {!pushVisible && offersInstall && <PwaInstallBanner />}
    </>
  );
}
