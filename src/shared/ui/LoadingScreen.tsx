import { useEffect, useState } from 'react';
import { Brand } from './Brand';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
export function LoadingScreen({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    if (!onRetry) {
      location.reload();
      return;
    }
    try {
      await onRetry();
    } catch {
      // Keep the existing error visible and allow another attempt.
    } finally {
      setRetrying(false);
    }
  };
  return (
    <main className="loading-screen" aria-busy={!error} aria-label="Cargando contenido">
      <div className="loading-shell">
        <header className="loading-header">
          <Brand />
        </header>
        {error ? (
          <div className="loading-error" role="alert">
            <h1>No se ha podido cargar la página</h1>
            <p>{error}</p>
            <Button loading={retrying} onClick={() => void retry()}>
              Volver a intentarlo
            </Button>
          </div>
        ) : (
          <div className="loading-content" role="status" aria-label="Cargando contenido">
            <span className="sr-only">Cargando contenido</span>
            <Skeleton className="h-4 w-28 mb-5" />
            <Skeleton className="h-10 w-64 max-w-full mb-4" />
            <Skeleton className="h-4 w-72 max-w-full mb-10" />
            <div className="loading-cards">
              {[0, 1, 2].map((item) => (
                <div className="loading-card" key={item}>
                  <Skeleton className="h-4 w-28 mb-8" />
                  <Skeleton className="h-8 w-36 max-w-full" />
                </div>
              ))}
            </div>
            <div className="loading-list">
              {[0, 1, 2].map((item) => (
                <div className="loading-row" key={item}>
                  <Skeleton className="h-5 w-48 max-w-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        )}
        {slow && !error && (
          <div className="loading-slow" role="status">
            <p>La carga está tardando más de lo habitual.</p>
            <Button variant="secondary" loading={retrying} onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
