import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { toUserMessage } from '@/shared/lib/errors';
import { Button } from '@/shared/ui/Button';

/** Route error boundary. Never shows technical messages. */
export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = toUserMessage(error, 'Ha ocurrido un error inesperado. Inténtalo de nuevo.');

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-sm text-center">
        <AlertTriangle size={48} className="mx-auto mb-4 text-accent" aria-hidden="true" />
        <h1 className="mb-2 text-xl font-bold text-ink">Algo salió mal</h1>
        <p className="mb-6 text-sm text-ink-muted">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RotateCcw size={16} aria-hidden="true" />
            Recargar
          </Button>
          <Button onClick={() => navigate('/', { replace: true })}>
            <Home size={16} aria-hidden="true" />
            Ir al inicio
          </Button>
        </div>
      </div>
    </main>
  );
}
