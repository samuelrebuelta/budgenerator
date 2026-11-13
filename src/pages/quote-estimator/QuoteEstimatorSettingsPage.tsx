import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { useProfileStore } from '@/entities/profile';
import {
  CONFIGURABLE_ESTIMATOR_ROOMS,
  deleteQuoteEstimatorSettings,
  ESTIMATOR_QUALITIES,
  fetchEstimatorLinkStatus,
  fetchQuoteEstimatorSettings,
  isSimpleQuoteEstimatorSettings,
  publishEstimatorLink,
  ROOM_REFERENCE_RATES,
  roomRateProblem,
  saveQuoteEstimatorSettings,
  validateEstimatorSettings,
  type ConfigurableEstimateRoom,
  type RoomEstimateRate,
  type SimpleQuoteEstimatorSettings,
} from '@/entities/quote-estimator';
import {
  Alert,
  Button,
  Card,
  ConfirmModal,
  Input,
  OfflineUnavailable,
  PageHeader,
  PageHeaderSkeleton,
  PageLayout,
  Skeleton,
  Switch,
} from '@/shared/ui';
import { toUserMessage } from '@/shared/lib';
import { EstimatorShareKit } from './components/EstimatorShareKit';
import { EstimatorPrerequisites } from './components/EstimatorPrerequisites';
import { missingRequirements } from './model/estimatorSharing';
import { useEstimatorRequirements } from './model/useEstimatorRequirements';
import {
  clearEstimatorDraft,
  readEstimatorDraft,
  writeEstimatorDraft,
} from './model/estimatorDraft';
import {
  getMemoryResource,
  loadMemoryResource,
  setMemoryResource,
} from '@/shared/lib/memoryResourceCache';
import { useNetworkStore } from '@/shared/model/network';

const emptySettings: SimpleQuoteEstimatorSettings = {
  schemaVersion: 2,
  rooms: [],
  contact: { sharePhone: false, shareEmail: false },
};

const steps = ['Estancias', 'Precios', 'Enlace'] as const;
const tenEuroCents = 1_000;

type SettingsSnapshot = {
  settings: SimpleQuoteEstimatorSettings;
  legacySetup: boolean;
  hasSavedSettings: boolean;
  token: string;
  paused: boolean;
  slug: string;
};

function euros(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Field of a room's prices that a validation problem refers to. */
function problemField(problem: string | null): 'min' | 'max' | 'step' | null {
  if (!problem) return null;
  if (/incremento|Lujo/.test(problem)) return 'step';
  if (problem.includes('precio hasta') || problem.includes('«desde» no puede')) return 'max';
  return 'min';
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
  const profile = useProfileStore((state) => state.profile);
  const requirements = useEstimatorRequirements();
  const [initialDraft] = useState(() => (uid ? readEstimatorDraft(uid) : null));
  const online = useNetworkStore((state) => state.online);
  const dataRefreshVersion = useNetworkStore((state) => state.dataRefreshVersion);
  const cacheKey = `private:${uid ?? ''}:quote-estimator-settings`;
  const cachedSnapshot = uid ? getMemoryResource<SettingsSnapshot>(cacheKey) : undefined;
  const [settings, setSettings] = useState<SimpleQuoteEstimatorSettings>(
    () => initialDraft?.settings ?? cachedSnapshot?.settings ?? emptySettings,
  );
  const savedSettings = useRef(JSON.stringify(cachedSnapshot?.settings ?? emptySettings));
  const settingsDirty = useRef(Boolean(initialDraft));
  const [step, setStep] = useState(() => initialDraft?.step ?? 0);
  const [showPriceErrors, setShowPriceErrors] = useState(false);
  const [token, setToken] = useState(() => cachedSnapshot?.token ?? '');
  const [paused, setPaused] = useState(() => cachedSnapshot?.paused ?? false);
  const [slug, setSlug] = useState(() => cachedSnapshot?.slug ?? '');
  const [legacySetup, setLegacySetup] = useState(() => cachedSnapshot?.legacySetup ?? false);
  const [hasSavedSettings, setHasSavedSettings] = useState(
    () => cachedSnapshot?.hasSavedSettings ?? false,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(() => cachedSnapshot === undefined && online);
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() =>
    initialDraft ? 'Hemos recuperado la configuración que aún no habías guardado.' : '',
  );

  const roomLabels = useMemo(
    () => new Map(CONFIGURABLE_ESTIMATOR_ROOMS.map(({ id, label }) => [id, label])),
    [],
  );

  // Keep unsaved changes across reloads and visits to Mi empresa.
  useEffect(() => {
    if (uid && settingsDirty.current) writeEstimatorDraft(uid, { settings, step });
  }, [uid, settings, step]);

  useEffect(() => {
    let active = true;
    if (!uid || settingsDirty.current) return;
    loadMemoryResource(cacheKey, async () => {
      const [saved, status] = await Promise.all([
        fetchQuoteEstimatorSettings(uid),
        fetchEstimatorLinkStatus(),
      ]);
      const snapshot: SettingsSnapshot = {
        settings:
          saved && isSimpleQuoteEstimatorSettings(saved)
            ? saved
            : { ...emptySettings, ...(saved ? { contact: saved.contact } : {}) },
        legacySetup: Boolean(saved && !isSimpleQuoteEstimatorSettings(saved)),
        hasSavedSettings: Boolean(saved),
        token: status.published ? (status.token ?? '') : '',
        paused: Boolean(status.published && status.paused),
        slug: status.slug ?? '',
      };
      return snapshot;
    })
      .then((snapshot) => {
        if (!active) return;
        const preserveDraft = settingsDirty.current;
        savedSettings.current = JSON.stringify(snapshot.settings);
        if (!preserveDraft) {
          settingsDirty.current = false;
          setSettings(snapshot.settings);
        }
        setLegacySetup(snapshot.legacySetup);
        setHasSavedSettings(snapshot.hasSavedSettings);
        setToken(snapshot.token);
        setPaused(snapshot.paused);
        setSlug(snapshot.slug);
      })
      .catch((cause) => {
        if (active && online)
          setError(cause instanceof Error ? cause.message : 'No se ha podido cargar el estimador.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid, cacheKey, online, dataRefreshVersion]);

  const cacheCurrentSnapshot = (patch: Partial<SettingsSnapshot>) => {
    setMemoryResource<SettingsSnapshot>(cacheKey, {
      settings,
      legacySetup,
      hasSavedSettings,
      token,
      paused,
      slug,
      ...patch,
    });
  };

  const updateRoom = (room: ConfigurableEstimateRoom, checked: boolean) => {
    settingsDirty.current = true;
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
    settingsDirty.current = true;
    setSettings((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.room === room ? { ...item, ...patch } : item)),
    }));
    setError('');
    setNotice('');
  };

  const updateContact = (patch: Partial<SimpleQuoteEstimatorSettings['contact']>) => {
    settingsDirty.current = true;
    setSettings((current) => ({ ...current, contact: { ...current.contact, ...patch } }));
    setError('');
    setNotice('');
  };

  const roomProblems = settings.rooms
    .map((rate) => ({ rate, problem: roomRateProblem(rate) }))
    .filter((item): item is { rate: RoomEstimateRate; problem: string } => Boolean(item.problem));

  const validateDraft = () => {
    if (roomProblems.length) {
      setShowPriceErrors(true);
      throw new Error(
        roomProblems.length === 1
          ? `${roomLabels.get(roomProblems[0]!.rate.room)}: ${roomProblems[0]!.problem}`
          : `Revisa los precios de ${roomProblems.length} estancias: ${roomProblems
              .map(({ rate }) => roomLabels.get(rate.room))
              .join(', ')}.`,
      );
    }
    validateEstimatorSettings(settings);
  };

  const validateForPublishing = () => {
    validateDraft();
    const missing = missingRequirements(requirements);
    if (missing.length)
      throw new Error(`Antes de publicar, ${missing.join(', ')} en «Antes de publicar».`);
  };

  const settingsSaved = () => {
    savedSettings.current = JSON.stringify(settings);
    settingsDirty.current = false;
    if (uid) clearEstimatorDraft(uid);
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
      settingsSaved();
      setHasSavedSettings(true);
      cacheCurrentSnapshot({ hasSavedSettings: true });
      setNotice('Configuración guardada. Los cambios ya se aplican al enlace publicado.');
    } catch (cause) {
      setError(toUserMessage(cause, 'No se ha podido guardar la configuración.'));
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
      await saveQuoteEstimatorSettings(uid, settings);
      settingsSaved();
      setHasSavedSettings(true);
      setLegacySetup(false);
      cacheCurrentSnapshot({ hasSavedSettings: true, legacySetup: false });
      setOperation('Generando enlace público…');
      const result = await publishEstimatorLink();
      setToken(result.token);
      setSlug(result.slug);
      setPaused(false);
      cacheCurrentSnapshot({
        hasSavedSettings: true,
        legacySetup: false,
        token: result.token,
        slug: result.slug,
        paused: false,
      });
      setNotice('Formulario publicado. Compártelo con los botones de arriba.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(toUserMessage(cause, 'No se ha podido publicar el formulario.'));
    } finally {
      setSaving(false);
      setOperation('');
    }
  };

  const handleDeleteSettings = async () => {
    if (!uid) return;
    setSaving(true);
    setOperation('Borrando configuración…');
    try {
      await deleteQuoteEstimatorSettings(uid);
      savedSettings.current = JSON.stringify(emptySettings);
      settingsDirty.current = false;
      if (uid) clearEstimatorDraft(uid);
      setSettings(emptySettings);
      setHasSavedSettings(false);
      setLegacySetup(false);
      setToken('');
      setPaused(false);
      setStep(0);
      cacheCurrentSnapshot({
        settings: emptySettings,
        hasSavedSettings: false,
        legacySetup: false,
        token: '',
        paused: false,
      });
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

  if (loading && online)
    return (
      <PageLayout>
        <div aria-busy="true">
          <PageHeaderSkeleton backTo="/profile" backLabel="Volver a mi empresa" />
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

  if (!online && cachedSnapshot === undefined)
    return (
      <PageLayout>
        <PageHeader
          title="Estimador público"
          description="Elige las estancias y define una orientación de precio sencilla para tu web."
          backTo="/profile"
          backLabel="Volver a mi empresa"
        />
        <OfflineUnavailable />
      </PageLayout>
    );

  return (
    <PageLayout>
      <PageHeader
        title="Estimador público"
        description="Elige las estancias y define una orientación de precio sencilla para tu web."
        backTo="/profile"
        backLabel="Volver a mi empresa"
      />

      {token ? (
        <Card className="mb-6 border-line bg-surface-muted p-5 sm:p-6">
          <EstimatorShareKit
            token={token}
            slug={slug}
            paused={paused}
            companyName={profile?.name ?? ''}
            busy={saving}
            onPausedChange={(next) => {
              setPaused(next);
              cacheCurrentSnapshot({ paused: next });
            }}
            onRevoked={() => {
              setToken('');
              setPaused(false);
              cacheCurrentSnapshot({ token: '', paused: false });
              setNotice('Enlace revocado. El formulario ya no acepta solicitudes.');
            }}
            onDeleteRequest={() => setShowDeleteConfirm(true)}
          />
        </Card>
      ) : (
        hasSavedSettings && (
          <Card className="mb-6 border-line bg-surface-muted p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Formulario sin publicar</h2>
                <p className="mt-1 text-sm text-gray-600">
                  La configuración está guardada. Publícalo en el paso «Enlace».
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={saving}>
                <Trash2 size={15} /> Borrar configuración
              </Button>
            </div>
          </Card>
        )
      )}
      {notice && (
        <p
          role="status"
          className="mb-6 rounded-lg bg-success-surface px-3 py-2 text-sm text-success-ink"
        >
          {notice}
        </p>
      )}

      {!token && <EstimatorPrerequisites />}

      <Card className="mb-6 border-0 bg-brand-50 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-gray-700">
            Define una horquilla aproximada por m². Alta y lujo se calculan a partir de un único
            incremento que puedes ajustar.
          </p>
          <span className="mt-1 w-fit shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary">
            Sin IVA · No vinculante
          </span>
        </div>
      </Card>

      {legacySetup && (
        <Alert tone="warning" plain role="none" className="mb-5">
          El enlace actual usa la configuración anterior y seguirá funcionando mientras preparas
          estos precios. Al generar el enlace con la nueva configuración, pasará al cálculo por m².
        </Alert>
      )}

      <nav aria-label="Pasos de configuración" className="mb-6">
        <ol className="flex items-center gap-2 sm:gap-4">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={`flex min-h-11 flex-1 items-center gap-2 border-b-2 pb-2 text-sm ${step === index ? 'border-primary font-semibold text-primary' : index < step ? 'border-brand-200 text-gray-700' : 'border-gray-200 text-gray-500'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? 'bg-primary text-white' : 'bg-gray-100'}`}
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
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${selected ? 'border-brand-300 bg-brand-50 text-primary' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => updateRoom(room.id, event.target.checked)}
                    className="h-4 w-4 accent-primary"
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
              const reference = ROOM_REFERENCE_RATES[roomRate.room];
              const problem = roomRateProblem(roomRate);
              const visibleProblem = showPriceErrors ? problem : null;
              const field = problemField(visibleProblem);
              const fieldError = (name: 'min' | 'max' | 'step') =>
                field === name && visibleProblem
                  ? visibleProblem.charAt(0).toUpperCase() + visibleProblem.slice(1)
                  : undefined;
              const exampleArea = reference.typicalAreaM2;
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
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        aria-label={`Usar precios orientativos en ${roomLabel}`}
                        onClick={() =>
                          updateRoomRate(roomRate.room, {
                            minimumCentsPerM2: reference.minimumCentsPerM2,
                            maximumCentsPerM2: reference.maximumCentsPerM2,
                            qualityStepCentsPerM2: reference.qualityStepCentsPerM2,
                          })
                        }
                      >
                        <Sparkles size={16} /> Precios orientativos
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Quitar ${roomLabel}`}
                        onClick={() => updateRoom(roomRate.room, false)}
                      >
                        <Trash2 size={16} /> Quitar
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Orientativo en España: {euros(reference.minimumCentsPerM2)} –{' '}
                    {euros(reference.maximumCentsPerM2)}/m² en calidad media. Ajústalo a tus
                    precios.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      id={`rate-min-${roomRate.room}`}
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      label="Media · desde €/m²"
                      placeholder={String(reference.minimumCentsPerM2 / 100)}
                      error={fieldError('min')}
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
                      placeholder={String(reference.maximumCentsPerM2 / 100)}
                      error={fieldError('max')}
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
                        error={fieldError('step')}
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
                      <li key={range.label} className="rounded-md bg-canvas px-3 py-2">
                        <span className="block text-xs text-gray-600">{range.label}</span>
                        <span className="font-medium tabular-nums text-primary">
                          {euros(range.minimum)} – {euros(range.maximum)}/m²
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!problem && (
                    <p className="mt-3 text-sm text-gray-700">
                      Ejemplo: {roomLabel.toLowerCase()} de {exampleArea} m² en calidad media,{' '}
                      <strong className="tabular-nums">
                        {euros(roomRate.minimumCentsPerM2 * exampleArea)} –{' '}
                        {euros(roomRate.maximumCentsPerM2 * exampleArea)}
                      </strong>{' '}
                      sin IVA.
                    </p>
                  )}
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
              <Switch
                label="Mostrar teléfono"
                description={profile?.phone ? `(${profile.phone})` : 'Añádelo en Mi empresa'}
                checked={settings.contact.sharePhone}
                disabled={!profile?.phone}
                onCheckedChange={(checked) => updateContact({ sharePhone: checked })}
                className="rounded-lg border border-gray-200 px-3"
              />
              <Switch
                label="Mostrar correo"
                description={profile?.email ? `(${profile.email})` : 'Añádelo en Mi empresa'}
                checked={settings.contact.shareEmail}
                disabled={!profile?.email}
                onCheckedChange={(checked) => updateContact({ shareEmail: checked })}
                className="rounded-lg border border-gray-200 px-3"
              />
            </div>
          </Card>

          <Card className="mt-4 border-line bg-surface-muted p-4 sm:p-5">
            <h3 className="font-semibold text-gray-900">Publicación</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {token
                ? 'Guarda aquí los cambios de precios o estancias; se aplican al momento con el mismo enlace.'
                : 'Al publicar tendrás un enlace corto, un código QR y botones para compartirlo por WhatsApp o en tu web.'}
            </p>
            {missingRequirements(requirements).length > 0 && (
              <Alert tone="warning" role="none" className="mt-3">
                Para publicar, {missingRequirements(requirements).join(', ')}. Hazlo en «Antes de
                publicar», arriba.
              </Alert>
            )}
            {token && !legacySetup ? (
              <div className="mt-4">
                <Button variant="secondary" onClick={handleSave} loading={saving}>
                  {saving ? operation || 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            ) : (
              <Button className="mt-4" onClick={handlePublish} loading={saving}>
                {saving ? operation || 'Guardando…' : 'Guardar y publicar formulario'}
              </Button>
            )}
            <div className="mt-3 min-h-6" aria-live="polite">
              {saving && <p className="text-sm text-gray-600">{operation || 'Procesando…'}</p>}
              {error && (
                <Alert tone="danger" plain>
                  {error}
                </Alert>
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
            <Alert tone="danger" plain>
              {error}
            </Alert>
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
