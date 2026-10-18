import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { getNotificationSettings } from '@/entities/notifications';
import { Button } from '@/shared/ui';
import {
  activatePushOnThisDevice,
  currentPushInstallationId,
  enablePushNotifications,
  getPushAvailability,
} from '../model/push';
import {
  getStartupPushPrompt,
  shouldRecoverInvalidPushDevice,
  shouldRefreshStalePushRegistration,
  type PushAvailability,
} from '../model/pushAvailability';

const DISMISSED_KEY_PREFIX = 'budgenerator:push-startup-dismissed:v1:';

function wasDismissed(uid: string) {
  try {
    return window.sessionStorage.getItem(`${DISMISSED_KEY_PREFIX}${uid}`) === 'true';
  } catch {
    return false;
  }
}

function saveDismissed(uid: string) {
  try {
    window.sessionStorage.setItem(`${DISMISSED_KEY_PREFIX}${uid}`, 'true');
  } catch {
    /* Dismissal only improves this session; storage is optional. */
  }
}

export function PushStartupPrompt() {
  const uid = useAuthStore((state) => state.user?.uid);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [availability, setAvailability] = useState<PushAvailability | 'checking'>('checking');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [currentDeviceEnabled, setCurrentDeviceEnabled] = useState(false);
  const [currentDeviceRecoveryRequired, setCurrentDeviceRecoveryRequired] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const load = async () => {
      try {
        const [initialSettings, nextAvailability] = await Promise.all([
          getNotificationSettings(),
          getPushAvailability(),
        ]);
        let settings = initialSettings;
        const installationId = currentPushInstallationId();
        const currentDevice = settings.devices.find(
          (device) => device.installationId === installationId,
        );
        let recoveryFailed = false;
        if (
          shouldRecoverInvalidPushDevice(
            nextAvailability,
            settings.preferences.pushEnabled,
            currentDevice?.recoveryRequired === true,
          ) &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            await activatePushOnThisDevice(true);
            if (useAuthStore.getState().user?.uid === uid) {
              settings = await getNotificationSettings();
            }
          } catch {
            recoveryFailed = true;
          }
        }
        if (!active || useAuthStore.getState().user?.uid !== uid) return;
        const refreshedDevice = settings.devices.find(
          (device) => device.installationId === installationId,
        );
        setAvailability(nextAvailability);
        setPushEnabled(settings.preferences.pushEnabled);
        setCurrentDeviceEnabled(refreshedDevice?.enabled === true);
        setCurrentDeviceRecoveryRequired(refreshedDevice?.recoveryRequired === true);
        setDismissed(wasDismissed(uid));
        setError(
          recoveryFailed
            ? 'No se ha podido recuperar el registro push. Puedes reactivarlo desde aquí o desde Mi cuenta.'
            : '',
        );
        setLoadedUid(uid);
      } catch {
        if (active && useAuthStore.getState().user?.uid === uid) {
          setAvailability('unsupported');
          setLoadedUid(uid);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [uid]);

  const isLoaded = Boolean(uid && loadedUid === uid);
  const prompt = getStartupPushPrompt(
    isLoaded ? availability : 'checking',
    isLoaded && pushEnabled,
    isLoaded && currentDeviceEnabled,
    !isLoaded || dismissed,
  );
  if (!uid || prompt === 'none') return null;

  const dismiss = () => {
    saveDismissed(uid);
    setDismissed(true);
  };

  const activate = async () => {
    setSaving(true);
    setError('');
    try {
      await enablePushNotifications(
        currentDeviceEnabled,
        shouldRefreshStalePushRegistration(
          pushEnabled,
          currentDeviceEnabled,
          currentDeviceRecoveryRequired,
        ),
      );
      setPushEnabled(true);
      setCurrentDeviceEnabled(true);
      setCurrentDeviceRecoveryRequired(false);
      setAvailability(await getPushAvailability());
      dismiss();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      if (code === 'push_permission_denied') {
        setAvailability('permission-blocked');
        setError(
          'El permiso está bloqueado. Cámbialo en los ajustes del navegador o del dispositivo y actívalo después desde Mi cuenta.',
        );
      } else if (code === 'push_unsupported') {
        setAvailability('unsupported');
        dismiss();
      } else {
        setError(
          'No se han podido activar los avisos push. Puedes volver a intentarlo desde Mi cuenta.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="mx-4 mt-4 flex flex-col gap-4 rounded-xl border border-[#cddbd1] bg-[#f4f8f4] p-4 shadow-sm sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8"
      aria-label="Activar notificaciones push"
      role="region"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Bell size={20} className="mt-0.5 shrink-0 text-[#315d4c]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-gray-900">
            {prompt === 'blocked'
              ? 'Permite los avisos push'
              : currentDeviceRecoveryRequired
                ? 'Reactiva los avisos push'
                : 'Activa los avisos push'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {prompt === 'blocked'
              ? 'El permiso está bloqueado para esta app. Cámbialo en los ajustes del navegador o del dispositivo y después actívalo desde Mi cuenta.'
              : currentDeviceRecoveryRequired
                ? 'La preferencia de tu cuenta sigue activa, pero FCM dejó de reconocer este dispositivo. Reactívalo para volver a recibir avisos aquí.'
                : 'Recibe un aviso cuando llegue una solicitud nueva. Al continuar, el navegador te pedirá permiso.'}
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {prompt === 'activate' ? (
          <Button type="button" loading={saving} onClick={() => void activate()}>
            {currentDeviceRecoveryRequired
              ? 'Reactivar este dispositivo'
              : 'Permitir notificaciones'}
          </Button>
        ) : (
          <Link
            to="/account"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[#234c40] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Abrir Mi cuenta
          </Link>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ahora no"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X size={17} />
        </button>
      </div>
    </section>
  );
}
