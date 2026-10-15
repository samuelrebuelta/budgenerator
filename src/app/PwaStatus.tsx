import { useEffect, useState } from 'react';
import { Download, WifiOff, RefreshCw } from 'lucide-react';
import { withTimeout } from '@/shared/model/session';
import { flushWrites, hasPendingWrites } from '@/shared/model/sync';
import { useBudgetStore } from '@/entities/budget';
import type { PwaUpdateEvent } from './pwa';
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [chunkError, setChunkError] = useState(false);
  const [error, setError] = useState('');
  const draft = useBudgetStore((s) => s.draftBudget);
  useEffect(() => {
    const connected = () => {
      setOnline(true);
      void flushWrites().catch(() => {});
    };
    const disconnected = () => setOnline(false);
    const available = (event: Event) => setUpdate((event as PwaUpdateEvent).detail);
    const missingChunk = (event: Event) => {
      event.preventDefault();
      setChunkError(true);
    };
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration('/')
        .then((registration) => {
          if (registration?.waiting) setUpdate(registration);
        })
        .catch(() => {});
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('cimbra:update', available);
    window.addEventListener('vite:preloadError', missingChunk);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('cimbra:update', available);
      window.removeEventListener('vite:preloadError', missingChunk);
    };
  }, []);
  const refresh = async () => {
    if (draft) {
      setError('Guarda o descarta el borrador antes de actualizar.');
      return;
    }
    try {
      await withTimeout(flushWrites());
      if (hasPendingWrites())
        throw new Error('Aún hay cambios por guardar. Reintenta cuando tengas conexión.');
      if (update?.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
          once: true,
        });
        update.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se puede actualizar todavía.');
    }
  };
  if (online && !update && !chunkError) return null;
  return (
    <aside className="pwa-notice no-print" aria-live="polite">
      {!online ? (
        <>
          <WifiOff size={18} />
          <span>
            Sin conexión. La sesión abierta sigue disponible; guardar y abrir datos nuevos requiere
            red.
          </span>
        </>
      ) : (
        <>
          <Download size={18} />
          <span>
            {chunkError
              ? 'Hay una versión nueva. Recarga para continuar.'
              : 'Hay una actualización disponible.'}
          </span>
          <button onClick={() => void refresh()}>
            <RefreshCw size={14} />
            Actualizar
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
