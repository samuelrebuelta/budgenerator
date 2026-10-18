import { useState } from 'react';
import { CloudUpload, AlertCircle } from 'lucide-react';
import { withTimeout } from '@/shared/model/session';
import { useSyncStore, flushWrites } from '@/shared/model/sync';
import { LoadingSpinner } from '@/shared/ui';
export function SyncStatus() {
  const jobs = useSyncStore((s) => s.jobs);
  const [retrying, setRetrying] = useState(false);
  const error = Object.values(jobs).find((j) => j.error)?.error;
  const pending = Object.values(jobs).some((j) => j.pending);
  const retry = async () => {
    setRetrying(true);
    try {
      await withTimeout(flushWrites());
    } catch {
      /* Keep the persistent retry status visible. */
    } finally {
      setRetrying(false);
    }
  };
  if (!error && !pending) return null;
  return error ? (
    <button
      className="sync-status sync-error"
      onClick={() => void retry()}
      disabled={retrying}
      aria-busy={retrying || undefined}
      title={error}
      aria-label={retrying ? 'Reintentando guardado' : 'Reintentar guardado'}
    >
      {retrying ? <LoadingSpinner size={15} /> : <AlertCircle size={15} />}
      <span>{retrying ? 'Reintentando…' : 'Reintentar guardado'}</span>
    </button>
  ) : (
    <span className="sync-status" role="status">
      <CloudUpload size={15} />
      <span>Guardando…</span>
    </span>
  );
}
