import { WifiOff } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function OfflineUnavailable() {
  return (
    <EmptyState
      icon={WifiOff}
      role="status"
      title="Contenido no disponible sin conexión"
      description="Esta pantalla aún no tiene datos cargados en esta sesión. Conéctate a internet para abrirla."
    />
  );
}
