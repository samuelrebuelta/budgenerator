import { useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import { pwaInstall } from './pwaInstall';
export function PwaInstallBanner() {
  const state = useSyncExternalStore(pwaInstall.subscribe, pwaInstall.getSnapshot);
  const [instructions, setInstructions] = useState(false);
  if (state.standalone || state.installed || state.dismissed) return null;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <aside className="pwa-install-banner no-print" aria-label="Instalar BudGenerator">
      <Download size={20} aria-hidden="true" />
      <div className="pwa-install-copy">
        <strong>BudGenerator, a mano</strong>
        <p>Instala la app para abrirla desde tu pantalla de inicio.</p>
        {instructions && (
          <p id="pwa-install-instructions">
            {ios
              ? 'En Safari, pulsa Compartir y después Añadir a pantalla de inicio.'
              : 'Abre el menú de tu navegador y busca Instalar aplicación o Añadir a pantalla de inicio, si está disponible.'}
          </p>
        )}
      </div>
      <Button
        variant="secondary"
        loading={state.pending}
        aria-expanded={state.canPrompt ? undefined : instructions}
        aria-controls={instructions ? 'pwa-install-instructions' : undefined}
        onClick={() =>
          state.canPrompt ? void pwaInstall.install() : setInstructions(!instructions)
        }
      >
        {state.pending ? 'Instalando…' : state.canPrompt ? 'Instalar app' : 'Cómo instalar'}
      </Button>
      <Button
        variant="ghost"
        aria-label="Ocultar aviso de instalación"
        onClick={pwaInstall.dismiss}
      >
        <X size={18} />
      </Button>
    </aside>
  );
}
