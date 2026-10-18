import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  LoaderCircle,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import {
  CONFIGURABLE_ESTIMATOR_ROOMS,
  deleteQuoteEstimatorSettings,
  ESTIMATOR_QUALITIES,
  fetchEstimatorLinkStatus,
  fetchQuoteEstimatorSettings,
  isSimpleQuoteEstimatorSettings,
  isValidPrivacyPolicyUrl,
  publishEstimatorLink,
  revokeEstimatorLink,
  saveQuoteEstimatorSettings,
  validateEstimatorSettings,
  type ConfigurableEstimateRoom,
  type RoomEstimateRate,
  type SimpleQuoteEstimatorSettings,
} from '@/entities/quote-estimator';
import {
  Button,
  Card,
  ConfirmModal,
  Input,
  PageHeader,
  PageHeaderSkeleton,
  PageLayout,
  Skeleton,
} from '@/shared/ui';

const emptySettings: SimpleQuoteEstimatorSettings = {
  schemaVersion: 2,
  rooms: [],
  contact: { sharePhone: false, shareEmail: false },
};

const steps = ['Estancias', 'Precios', 'Enlace'] as const;
const tenEuroCents = 1_000;

function euros(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function readEuroInput(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function readNonNegativeEuroInput(value: string) {
  if (value === '') return 0;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function QuoteEstimatorSettingsPage() {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  return <QuoteEstimatorSettingsContent key={uid ?? 'signed-out'} uid={uid} />;
}

function QuoteEstimatorSettingsContent({ uid }: { uid: string | null }) {
  const navigate = useNavigate();
  const profile = useProfileStore((state) => state.profile);
  const [settings, setSettings] = useState<SimpleQuoteEstimatorSettings>(emptySettings);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [legacySetup, setLegacySetup] = useState(false);
  const [hasSavedSettings, setHasSavedSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const roomLabels = useMemo(
    () => new Map(CONFIGURABLE_ESTIMATOR_ROOMS.map(({ id, label }) => [id, label])),
    [],
  );
  const publicUrl = token ? `${window.location.origin}/solicitar-presupuesto/${token}` : '';
  const missingProfileName = !profile?.name?.trim();
  const missingPrivacyUrl = !isValidPrivacyPolicyUrl(profile?.privacyPolicyUrl);

  useEffect(() => {
    let active = true;
    if (!uid) return;
    Promise.all([fetchQuoteEstimatorSettings(uid), fetchEstimatorLinkStatus()])
      .then(([saved, status]) => {
        if (!active) return;
        setHasSavedSettings(Boolean(saved));
        if (saved && isSimpleQuoteEstimatorSettings(saved)) {
          setSettings(saved);
          setLegacySetup(false);
        } else if (saved) {
          setSettings({ ...emptySettings, contact: saved.contact });
          setLegacySetup(true);
        }
        setToken(status.published ? (status.token ?? '') : '');
      })
      .catch(() => {
        if (active) setError('No se ha podido cargar el estimador. Vuelve a intentarlo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const updateRoom = (room: ConfigurableEstimateRoom, checked: boolean) => {
    setSettings((current) => ({
      ...current,
      rooms: checked
        ? [
            ...current.rooms,
            {
              room,
              minimumCentsPerM2: 0,
              maximumCentsPerM2: 0,
              qualityStepCentsPerM2: 0,
            },
          ]
        : current.rooms.filter((item) => item.room !== room),
    }));
    setError('');
    setNotice('');
  };

  const updateRoomRate = (room: ConfigurableEstimateRoom, patch: Partial<RoomEstimateRate>) => {
    setSettings((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.room === room ? { ...item, ...patch } : item)),
    }));
    setError('');
    setNotice('');
  };

  const updateContact = (patch: Partial<SimpleQuoteEstimatorSettings['contact']>) => {
    setSettings((current) => ({ ...current, contact: { ...current.contact, ...patch } }));
    setError('');
    setNotice('');
  };

  const validateDraft = () => {
    validateEstimatorSettings(settings);
  };

  const validateForPublishing = () => {
    validateDraft();
    if (missingProfileName) throw new Error('Completa primero el nombre de empresa en Mi empresa.');
  };

  const goNext = () => {
    setError('');
    setNotice('');
    try {
      if (step === 0 && settings.rooms.length === 0)
        throw new Error('Selecciona al menos una estancia para continuar.');
      if (step === 1) validateDraft();
      setStep((current) => Math.min(current + 1, steps.length - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa los precios configurados.');
    }
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    setOperation('Guardando cambios…');
    setError('');
    setNotice('');
    try {
      validateForPublishing();
      await saveQuoteEstimatorSettings(uid, settings);
      setHasSavedSettings(true);
      setNotice('Configuración guardada. Los cambios ya se aplican al enlace publicado.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se ha podido guardar la configuración.',
      );
    } finally {
      setSaving(false);
      setOperation('');
    }
  };

  const handlePublish = async () => {
    if (!uid) return;
    setSaving(true);
    setOperation('Guardando configuración…');
    setError('');
    setNotice('');
    try {
      validateForPublishing();
      if (missingPrivacyUrl)
        throw new Error(
          'Añade una URL HTTPS al aviso de privacidad en Mi empresa antes de publicar.',
        );
      await saveQuoteEstimatorSettings(uid, settings);
      setHasSavedSettings(true);
      setLegacySetup(false);
      setOperation('Generando enlace público…');
      const result = await publishEstimatorLink();
      setToken(result.token);
      setNotice('Enlace generado. Ya puedes copiarlo y añadirlo a la landing de tu empresa.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido generar el enlace.');
    } finally {
      setSaving(false);
      setOperation('');
    }
  };

  const handleRevoke = async () => {
    setSaving(true);
    setOperation('Revocando enlace…');
    setError('');
    setNotice('');
    try {
      await revokeEstimatorLink();
      setToken('');
      setNotice('Enlace revocado. Dejará de mostrar el estimador.');
    } catch {
      setError('No se ha podido revocar el enlace. Vuelve a intentarlo.');
    } finally {
      setSaving(false);
      setOperation('');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice('Enlace copiado.');
      setError('');
    } catch {
      setError('No se ha podido copiar. Selecciona la URL y cópiala manualmente.');
    }
  };

  const handleDeleteSettings = async () => {
    if (!uid) return;
    setSaving(true);
    setOperation('Borrando configuración…');
    try {
      await deleteQuoteEstimatorSettings(uid);
      setSettings(emptySettings);
      setHasSavedSettings(false);
      setLegacySetup(false);
      setToken('');
      setStep(0);
      setNotice('Configuración borrada y enlace revocado. Los leads recibidos se conservan.');
      setError('');
      setShowDeleteConfirm(false);
    } catch {
      throw new Error('No se ha podido borrar la configuración. Vuelve a intentarlo.');
    } finally {
      setSaving(false);
      setOperation('');
    }
  };

  if (loading)
    return (
      <PageLayout>
        <div aria-busy="true">
          <PageHeaderSkeleton />
          <Card className="mb-6 space-y-4 p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-14 w-full" />
          </Card>
          <Card className="space-y-4 p-5">
            <Skeleton className="h-7 w-56" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </Card>
        </div>
      </PageLayout>
    );

  return (
    <PageLayout>
      <PageHeader
        title="Estimador público"
        description="Elige las estancias y define una orientación de precio sencilla para tu web."
      />

      {(hasSavedSettings || token) && (
        <Card className="mb-6 border-[#dfe9e3] bg-[#fbfdfb] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Resumen del estimador</h2>
              {!token && (
                <p className="mt-1 text-sm text-gray-600">
                  Configuración guardada. Aún no hay un enlace público activo.
                </p>
              )}
            </div>
            {token && (
              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Enlace activo
              </span>
            )}
          </div>
          {token && (
            <Input
              id="estimator-summary-url"
              label="Enlace público"
              value={publicUrl}
              readOnly
              className="mt-4 bg-white font-mono text-xs"
            />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {token && (
              <>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#234c40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c3e34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426457]"
                >
                  <ExternalLink size={15} /> Abrir formulario
                </a>
                <Button variant="secondary" onClick={copyLink} disabled={saving}>
                  <Copy size={15} /> Copiar enlace
                </Button>
                <Button variant="danger" onClick={handleRevoke} loading={saving}>
                  {saving ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />{' '}
                      {operation || 'Revocando…'}
                    </>
                  ) : (
                    'Revocar enlace'
                  )}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={saving}>
              <Trash2 size={15} /> Borrar configuración
            </Button>
          </div>
          <div className="mt-3 min-h-6" aria-live="polite">
            {notice && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {notice}
              </p>
            )}
          </div>
        </Card>
      )}

      <Card className="mb-6 border-0 bg-[#edf3ef] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-gray-700">
            Define una horquilla aproximada por m². Alta y lujo se calculan a partir de un único
            incremento que puedes ajustar.
          </p>
          <span className="mt-1 w-fit shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#426457]">
            Sin IVA · No vinculante
          </span>
        </div>
      </Card>

      {legacySetup && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          El enlace actual usa la configuración anterior y seguirá funcionando mientras preparas
          estos precios. Al generar el enlace con la nueva configuración, pasará al cálculo por m².
        </p>
      )}

      <nav aria-label="Pasos de configuración" className="mb-6">
        <ol className="flex items-center gap-2 sm:gap-4">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={`flex min-h-11 flex-1 items-center gap-2 border-b-2 pb-2 text-sm ${step === index ? 'border-[#426457] font-semibold text-[#234c40]' : index < step ? 'border-[#b5c8bb] text-gray-700' : 'border-gray-200 text-gray-500'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? 'bg-[#234c40] text-white' : 'bg-gray-100'}`}
              >
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 && (
        <section aria-labelledby="estimator-rooms-heading">
          <h2 id="estimator-rooms-heading" className="text-xl font-semibold text-gray-900">
            ¿Qué estancias quieres incluir?
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            Selecciona cada estancia una vez. Quien rellene el formulario podrá elegir una o varias.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CONFIGURABLE_ESTIMATOR_ROOMS.map((room) => {
              const selected = settings.rooms.some((item) => item.room === room.id);
              return (
                <label
                  key={room.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${selected ? 'border-[#91a99b] bg-[#edf3ef] text-[#234c40]' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => updateRoom(room.id, event.target.checked)}
                    className="h-4 w-4 accent-[#426457]"
                  />
                  {room.label}
                </label>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="estimator-prices-heading">
          <h2 id="estimator-prices-heading" className="text-xl font-semibold text-gray-900">
            Horquilla por estancia
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            Indica el precio por m² para calidad media y el incremento que se añade al subir cada
            nivel. El formulario multiplicará estos valores por los metros indicados.
          </p>
          <div className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white px-4 sm:px-5">
            {settings.rooms.map((roomRate) => {
              const roomLabel = roomLabels.get(roomRate.room) ?? roomRate.room;
              const qualityRanges = ESTIMATOR_QUALITIES.map((quality, index) => {
                const increment = roomRate.qualityStepCentsPerM2 * index;
                return {
                  label: quality.label,
                  minimum: roomRate.minimumCentsPerM2 + increment,
                  maximum: roomRate.maximumCentsPerM2 + increment,
                };
              });
              return (
                <section key={roomRate.room} className="py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">{roomLabel}</h3>
                    <Button
                      variant="ghost"
                      aria-label={`Quitar ${roomLabel}`}
                      onClick={() => updateRoom(roomRate.room, false)}
                    >
                      <Trash2 size={16} /> Quitar
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      id={`rate-min-${roomRate.room}`}
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      label="Media · desde €/m²"
                      value={roomRate.minimumCentsPerM2 ? roomRate.minimumCentsPerM2 / 100 : ''}
                      onChange={(event) =>
                        updateRoomRate(roomRate.room, {
                          minimumCentsPerM2: readEuroInput(event.target.value),
                        })
                      }
                    />
                    <Input
                      id={`rate-max-${roomRate.room}`}
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      label="Media · hasta €/m²"
                      value={roomRate.maximumCentsPerM2 ? roomRate.maximumCentsPerM2 / 100 : ''}
                      onChange={(event) =>
                        updateRoomRate(roomRate.room, {
                          maximumCentsPerM2: readEuroInput(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <p className="mb-1 text-sm font-medium text-gray-800">Incremento por nivel</p>
                      <p className="mb-2 text-xs text-gray-500">
                        Se añade a Alta y de nuevo a Lujo.
                      </p>
                      <Input
                        id={`quality-step-${roomRate.room}`}
                        type="number"
                        min="0"
                        max="100000"
                        step="0.01"
                        label="Incremento €/m²"
                        value={roomRate.qualityStepCentsPerM2 / 100}
                        onChange={(event) =>
                          updateRoomRate(roomRate.room, {
                            qualityStepCentsPerM2: readNonNegativeEuroInput(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:pb-1">
                      <Button
                        variant="secondary"
                        aria-label={`Reducir incremento de ${roomLabel} en 10 euros por metro cuadrado`}
                        disabled={roomRate.qualityStepCentsPerM2 < tenEuroCents}
                        onClick={() =>
                          updateRoomRate(roomRate.room, {
                            qualityStepCentsPerM2: roomRate.qualityStepCentsPerM2 - tenEuroCents,
                          })
                        }
                      >
                        <Minus size={15} /> 10
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label={`Aumentar incremento de ${roomLabel} en 10 euros por metro cuadrado`}
                        disabled={roomRate.qualityStepCentsPerM2 + tenEuroCents > 10_000_000}
                        onClick={() =>
                          updateRoomRate(roomRate.room, {
                            qualityStepCentsPerM2: roomRate.qualityStepCentsPerM2 + tenEuroCents,
                          })
                        }
                      >
                        <Plus size={15} /> 10
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    {qualityRanges.map((range) => (
                      <li key={range.label} className="rounded-md bg-[#f3f5f1] px-3 py-2">
                        <span className="block text-xs text-gray-600">{range.label}</span>
                        <span className="font-medium tabular-nums text-[#234c40]">
                          {euros(range.minimum)} – {euros(range.maximum)}/m²
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="estimator-link-heading">
          <h2 id="estimator-link-heading" className="text-xl font-semibold text-gray-900">
            Contacto y enlace
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            El enlace muestra solo el teléfono o correo que autorices. Los precios se calculan en el
            servidor y no se publican como tarifas unitarias.
          </p>

          <Card className="mt-4 p-4 sm:p-5">
            <h3 className="font-semibold text-gray-900">Datos de contacto públicos</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.contact.sharePhone}
                  disabled={!profile?.phone}
                  onChange={(event) => updateContact({ sharePhone: event.target.checked })}
                />
                <span>
                  Mostrar teléfono{' '}
                  {profile?.phone ? `(${profile.phone})` : '· añádelo en Mi empresa'}
                </span>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.contact.shareEmail}
                  disabled={!profile?.email}
                  onChange={(event) => updateContact({ shareEmail: event.target.checked })}
                />
                <span>
                  Mostrar correo {profile?.email ? `(${profile.email})` : '· añádelo en Mi empresa'}
                </span>
              </label>
            </div>
          </Card>

          <Card className="mt-4 border-[#dfe9e3] bg-[#fbfdfb] p-4 sm:p-5">
            <h3 className="font-semibold text-gray-900">Publicación</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {token
                ? 'Guarda aquí los cambios de precios o estancias. El enlace se gestiona desde el resumen superior.'
                : 'Al guardar se generará el enlace que podrás añadir a la landing de tu empresa.'}
            </p>
            {(missingProfileName || missingPrivacyUrl) && (
              <p className="mt-3 text-sm text-amber-800">
                {missingProfileName && 'Falta el nombre de empresa. '}
                {missingPrivacyUrl && 'Falta la URL HTTPS del aviso de privacidad. '}
                <button
                  className="font-semibold underline underline-offset-2"
                  onClick={() => navigate('/profile')}
                >
                  Completar Mi empresa
                </button>
              </p>
            )}
            {token && !legacySetup ? (
              <div className="mt-4">
                <Button variant="secondary" onClick={handleSave} loading={saving}>
                  {saving ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />{' '}
                      {operation || 'Guardando…'}
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </Button>
              </div>
            ) : (
              <Button className="mt-4" onClick={handlePublish} loading={saving}>
                {saving ? (
                  <>
                    <LoaderCircle size={15} className="animate-spin" /> {operation || 'Guardando…'}
                  </>
                ) : (
                  'Guardar y generar enlace'
                )}
              </Button>
            )}
            <div className="mt-3 min-h-6" aria-live="polite">
              {saving && <p className="text-sm text-gray-600">{operation || 'Procesando…'}</p>}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
          </Card>
        </section>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              setError('');
              setStep((current) => Math.max(0, current - 1));
            }}
          >
            <ArrowLeft size={15} /> Anterior
          </Button>
        )}
        {step < steps.length - 1 && (
          <Button onClick={goNext}>
            Continuar <ArrowRight size={15} />
          </Button>
        )}
      </div>
      {step < steps.length - 1 && (
        <div className="mt-3 min-h-6" aria-live="polite">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Borrar configuración del estimador"
        message="Se revocará el enlace público y se borrarán las estancias y tarifas configuradas. Los leads ya recibidos se conservarán."
        confirmLabel="Borrar configuración"
        onConfirm={handleDeleteSettings}
      />
    </PageLayout>
  );
}
