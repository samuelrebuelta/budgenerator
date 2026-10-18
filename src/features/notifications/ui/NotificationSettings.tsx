import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import {
  getNotificationSettings,
  revokePushDevice,
  setNotificationPreferences,
} from '@/entities/notifications';
import type { NotificationSettingsResponse } from '@/shared/types';
import { Button, Card, Switch } from '@/shared/ui';
import {
  currentPushInstallationId,
  enablePushNotifications,
  getPushAvailability,
  reconcilePendingPushRevocations,
  revokePushOnThisDevice,
  type PushAvailability,
} from '../model/push';
import { shouldRefreshStalePushRegistration } from '../model/pushAvailability';

const emptySettings: NotificationSettingsResponse = {
  preferences: { pushEnabled: false },
  devices: [],
};

function availabilityMessage(value: PushAvailability | 'checking') {
  switch (value) {
    case 'checking':
      return 'Comprobando este navegador…';
    case 'ready':
      return 'Este dispositivo puede recibir avisos push.';
    case 'permission-required':
      return 'Activa el interruptor para permitir los avisos en este dispositivo.';
    case 'permission-blocked':
      return 'El permiso está bloqueado. Cámbialo en los ajustes del navegador o del dispositivo y vuelve a activar el interruptor.';
    case 'service-worker-unavailable':
      return 'La app no ha podido preparar los avisos push. Actualízala y vuelve a intentarlo.';
    case 'vapid-unconfigured':
      return 'La activación de avisos push todavía no está disponible en esta aplicación.';
    case 'unsupported':
      return 'Este dispositivo o navegador no admite avisos push web.';
  }
}

function deviceSeenAt(value: string | null) {
  if (!value) return 'Actividad reciente no disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Actividad reciente no disponible'
    : `Visto ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)}`;
}

export function NotificationSettings() {
  const uid = useAuthStore((state) => state.user?.uid);
  const [settings, setSettings] = useState<NotificationSettingsResponse>(emptySettings);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<PushAvailability | 'checking'>('checking');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(currentPushInstallationId);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const currentSettings = uid && loadedUid === uid ? settings : emptySettings;
  const isLoading = !uid || loadedUid !== uid;
  const currentError = uid && loadedUid === uid ? error : '';
  const currentDeviceEnabled = currentSettings.devices.some(
    (device) => device.enabled && device.installationId === currentDeviceId,
  );
  const currentDeviceRecoveryRequired = currentSettings.devices.some(
    (device) => device.recoveryRequired && device.installationId === currentDeviceId,
  );

  const reload = async (ownerUid: string) => {
    const next = await getNotificationSettings();
    if (useAuthStore.getState().user?.uid === ownerUid) {
      setSettings(next);
      setLoadedUid(ownerUid);
    }
  };

  useEffect(() => {
    if (!uid) return;
    let active = true;
    void getPushAvailability().then((support) => {
      if (active) setAvailability(support);
    });
    void reconcilePendingPushRevocations(uid)
      .then(() => getNotificationSettings())
      .then((next) => {
        if (!active || useAuthStore.getState().user?.uid !== uid) return;
        setSettings(next);
        setLoadedUid(uid);
        setCurrentDeviceId(currentPushInstallationId());
        setError('');
        setStatus('');
      })
      .catch(() => {
        if (!active || useAuthStore.getState().user?.uid !== uid) return;
        setSettings(emptySettings);
        setLoadedUid(uid);
        setError('No se han podido cargar los ajustes de notificaciones.');
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const visibleAvailability = uid && loadedUid === uid ? availability : 'checking';

  useEffect(() => {
    const refreshAvailability = () => {
      if (document.visibilityState === 'visible') void getPushAvailability().then(setAvailability);
    };
    window.addEventListener('focus', refreshAvailability);
    document.addEventListener('visibilitychange', refreshAvailability);
    return () => {
      window.removeEventListener('focus', refreshAvailability);
      document.removeEventListener('visibilitychange', refreshAvailability);
    };
  }, []);

  const updatePreference = async (enabled: boolean) => {
    if (!uid || saving) return;
    setStatus('');
    setError('');
    setSaving(true);
    try {
      if (enabled) {
        const id = await enablePushNotifications(
          currentDeviceEnabled,
          shouldRefreshStalePushRegistration(
            currentSettings.preferences.pushEnabled,
            currentDeviceEnabled,
            currentDeviceRecoveryRequired,
          ),
        );
        setCurrentDeviceId(id);
        setSettings((current) => ({ ...current, preferences: { pushEnabled: true } }));
        setStatus('Avisos push activados en este dispositivo.');
        setAvailability(await getPushAvailability());
        await reload(uid);
      } else {
        const result = await setNotificationPreferences({ pushEnabled: false });
        if (useAuthStore.getState().user?.uid === uid) {
          setSettings((current) => ({ ...current, preferences: result.preferences }));
          setStatus('Avisos push desactivados.');
        }
      }
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      if (code === 'push_permission_denied') {
        setAvailability('permission-blocked');
        setError(availabilityMessage('permission-blocked'));
      } else if (code === 'push_unsupported') {
        setAvailability('unsupported');
        setError(availabilityMessage('unsupported'));
      } else if (code === 'push_vapid_unconfigured') {
        setAvailability('vapid-unconfigured');
        setError(availabilityMessage('vapid-unconfigured'));
      } else if (code === 'push_service_worker_unavailable') {
        setAvailability('service-worker-unavailable');
        setError(availabilityMessage('service-worker-unavailable'));
      } else if (code === 'push_device_storage_unavailable') {
        setError('Este navegador no permite guardar la identidad privada del dispositivo.');
      } else if (code === 'push_registration_timeout') {
        setError('El registro push está tardando más de lo esperado. Vuelve a intentarlo.');
      } else {
        setError('No se ha podido guardar el cambio. Vuelve a intentarlo.');
      }
    } finally {
      setSaving(false);
    }
  };

  const revokeDevice = async (installationId: string) => {
    if (!uid || saving) return;
    setSaving(true);
    setSavingDeviceId(installationId);
    setError('');
    setStatus('');
    try {
      if (installationId === currentDeviceId) {
        await revokePushOnThisDevice();
        setCurrentDeviceId(null);
        setAvailability(await getPushAvailability());
      } else {
        await revokePushDevice(installationId);
      }
      await reload(uid);
      setStatus('Dispositivo revocado.');
    } catch {
      setError('No se ha podido revocar el dispositivo. Vuelve a intentarlo.');
    } finally {
      setSavingDeviceId(null);
      setSaving(false);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="notification-settings-title">
      <h2 id="notification-settings-title" className="mb-1 text-lg font-semibold text-gray-900">
        Notificaciones
      </h2>
      <p className="mb-4 max-w-2xl text-sm leading-6 text-gray-600">
        Recibe un aviso cuando llegue una solicitud nueva. El aviso no incluye datos de contacto.
      </p>

      <Card className="divide-y divide-gray-100 overflow-hidden">
        <Switch
          label="Avisos push"
          description={availabilityMessage(visibleAvailability)}
          leading={<Bell size={19} className="text-[#668175]" aria-hidden="true" />}
          checked={currentSettings.preferences.pushEnabled}
          disabled={isLoading || saving}
          loading={saving && savingDeviceId === null}
          onCheckedChange={(enabled) => void updatePreference(enabled)}
          className="p-4 sm:p-5"
        />

        <div className="p-4 sm:p-5">
          <div>
            <h3 className="font-medium text-gray-900">Dispositivos</h3>
            <p className="mt-1 text-sm text-gray-600">
              Push solo llega a los dispositivos que actives por separado.
            </p>
          </div>

          {currentSettings.devices.length > 0 ? (
            <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {currentSettings.devices.map((device) => {
                const isCurrent = device.installationId === currentDeviceId;
                return (
                  <li
                    key={device.installationId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {isCurrent ? 'Este dispositivo' : 'Otro dispositivo'}
                        {device.recoveryRequired
                          ? ' · Necesita reactivarse'
                          : !device.enabled && ' · Desactivado'}
                      </p>
                      <p className="text-xs text-gray-500">{deviceSeenAt(device.lastSeenAt)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      loading={savingDeviceId === device.installationId}
                      onClick={() => void revokeDevice(device.installationId)}
                    >
                      Revocar
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
              Todavía no hay dispositivos push activados.
            </p>
          )}
        </div>
      </Card>

      {!isLoading && currentSettings.preferences.pushEnabled && currentDeviceRecoveryRequired && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900" role="status">
            La preferencia de la cuenta sigue activa, pero FCM dejó de reconocer este dispositivo.
            Reactívalo para volver a recibir avisos aquí.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            loading={saving && savingDeviceId === null}
            onClick={() => void updatePreference(true)}
          >
            Reactivar este dispositivo
          </Button>
        </div>
      )}

      {isLoading && <p className="mt-3 text-sm text-gray-500">Cargando preferencias…</p>}
      {status && (
        <p className="mt-3 text-sm text-[#315d4c]" role="status">
          {status}
        </p>
      )}
      {currentError && (
        <p className="field-error mt-3" role="alert">
          {currentError}
        </p>
      )}
    </section>
  );
}
