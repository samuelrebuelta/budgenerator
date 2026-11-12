import { useEffect, useRef, useState } from 'react';
import { Download, WifiOff, RefreshCw } from 'lucide-react';
import { withTimeout } from '@/shared/model/session';
import { flushWrites, hasPendingWrites } from '@/shared/model/sync';
import { useBudgetStore } from '@/entities/budget';
import { useAuthStore } from '@/entities/auth';
import { LoadingSpinner } from '@/shared/ui';
import { setNetworkOnline, useNetworkStore } from '@/shared/model/network';
import { probeSessionConnection, retryUnauthenticatedRouteConnection } from './session';
import { refreshAfterNetworkRecovery } from './refreshOnReconnect';
import type { PwaUpdateEvent } from './pwa';
export function PwaStatus() {
  const online = useNetworkStore((state) => state.online);
  const browserOnline = useNetworkStore((state) => state.browserOnline);
  const recoveryVersion = useNetworkStore((state) => state.recoveryVersion);
  const recoverySource = useNetworkStore((state) => state.recoverySource);
  const user = useAuthStore((state) => state.user);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [chunkError, setChunkError] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const handledRecoveryVersion = useRef(0);
  const draft = useBudgetStore((s) => s.draft);
  useEffect(() => {
    const connected = () => {
      setNetworkOnline(true);
    };
    const disconnected = () => setNetworkOnline(false);
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
  useEffect(() => {
    if (online || !browserOnline) return;
    const retryTimer = window.setInterval(() => {
      if (user) void probeSessionConnection(user).catch(() => {});
      else retryUnauthenticatedRouteConnection();
    }, 30_000);
    return () => window.clearInterval(retryTimer);
  }, [online, browserOnline, user]);
  useEffect(() => {
    if (recoveryVersion <= handledRecoveryVersion.current) return;
    handledRecoveryVersion.current = recoveryVersion;
    void refreshAfterNetworkRecovery(user, recoverySource === 'session').catch(() => {});
  }, [recoveryVersion, recoverySource, user]);
  const refresh = async () => {
    if (refreshing) return;
    if (draft) {
      setError('Guarda o descarta el borrador antes de actualizar.');
      return;
    }
    setRefreshing(true);
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
      setRefreshing(false);
    }
  };
  if (online && !update && !chunkError) return null;
  return (
    <aside className="pwa-notice no-print" aria-live="polite">
      {!online ? (
        <>
          <WifiOff size={18} />
          <span>
            Sin conexión. Puedes consultar los últimos datos guardados; guardar o cargar información
            nueva requiere red.
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
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
          >
            {refreshing ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
