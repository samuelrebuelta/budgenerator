import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import {
  listenForForegroundLeadNotifications,
  refreshPushOwner,
  synchronizeActivePushInstallation,
  type ForegroundLeadNotification,
} from '../model/push';

export function ForegroundNotificationHost() {
  const uid = useAuthStore((state) => state.user?.uid);
  const [notice, setNotice] = useState<ForegroundLeadNotification | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!uid) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let stopPushSync: (() => void) | undefined;
    void refreshPushOwner(uid)
      .then(() => (active ? synchronizeActivePushInstallation(uid) : () => {}))
      .then((stop) => {
        if (active) stopPushSync = stop;
        else stop();
      });
    void listenForForegroundLeadNotifications((next) => {
      if (!active || seen.current.has(next.jobId)) return;
      seen.current.add(next.jobId);
      if (seen.current.size > 50) seen.current.delete(seen.current.values().next().value ?? '');
      setNotice(next);
    }).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    });
    return () => {
      active = false;
      unsubscribe?.();
      stopPushSync?.();
    };
  }, [uid]);

  if (!notice) return null;
  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[#cddbd1] bg-white p-4 shadow-[0_12px_36px_rgba(20,45,35,0.18)] md:bottom-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Bell size={18} className="mt-0.5 shrink-0 text-[#315d4c]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">Nueva solicitud de presupuesto</p>
          <p className="mt-1 text-sm text-gray-600">Tienes una nueva solicitud en BudGenerator.</p>
          <Link
            to={notice.managementPath}
            onClick={() => setNotice(null)}
            className="mt-3 inline-flex min-h-11 items-center font-medium text-[#234c40] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Ver solicitud
          </Link>
        </div>
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => setNotice(null)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
