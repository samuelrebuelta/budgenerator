import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  ESTIMATOR_QUALITIES,
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  MAX_ESTIMATOR_ROOM_QUANTITY,
  LEGACY_ESTIMATOR_QUALITIES,
  LEAD_START_TIMINGS,
  fetchPublicEstimator,
  requestPublicLead,
  requestPublicEstimate,
  validateLeadContact,
  type LeadContact,
  type EstimateRoom,
  type EstimateScope,
  type AnyEstimateQuality,
  type EstimateSelection,
  type LeadStartTiming,
  type PublicEstimatorInfo,
  type QuoteEstimate,
} from '@/entities/quote-estimator';
import { Button, Card, Input, Select, Skeleton } from '@/shared/ui';
import { Brand } from '@/shared/ui/Brand';

function formatEuro(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function optionLabel<T extends string>(options: readonly { id: T; label: string }[], value: T) {
  return options.find((option) => option.id === value)?.label ?? value;
}

export function QuoteEstimatorPage() {
  const { token = '' } = useParams();
  return <PublicEstimator key={token} token={token} />;
}

function PublicEstimator({ token }: { token: string }) {
  const [company, setCompany] = useState<PublicEstimatorInfo | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selections, setSelections] = useState<EstimateSelection[]>([]);
  const [scope, setScope] = useState<EstimateScope>('partial');
  const [contact, setContact] = useState<LeadContact>({ name: '', email: '', phone: '' });
  const [startTiming, setStartTiming] = useState<LeadStartTiming | ''>('');
  const [consent, setConsent] = useState(false);
  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const submissionKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicEstimator(token)
      .then((result) => {
        if (active) setCompany(result);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const configuredRooms = useMemo(
    () => new Set(company?.services.map((service) => service.room)),
    [company],
  );
  const qualityOptions: readonly { id: AnyEstimateQuality; label: string }[] =
    company?.schemaVersion === 2 ? ESTIMATOR_QUALITIES : LEGACY_ESTIMATOR_QUALITIES;
  const contactSummary = useMemo(() => {
    if (!company || !estimate) return '';
    const roomOrdinals = new Map<EstimateRoom, number>();
    const options = selections.map((selection) => {
      const roomOption = ESTIMATOR_ROOMS.find((option) => option.id === selection.room);
      const ordinal = (roomOrdinals.get(selection.room) ?? 0) + 1;
      roomOrdinals.set(selection.room, ordinal);
      const quantity = selection.quantity ?? 1;
      const room = selection.instanceId
        ? `${roomOption?.label ?? selection.room} ${ordinal}`
        : quantity > 1
          ? `${roomOption?.pluralLabel ?? selection.room} (${quantity})`
          : (roomOption?.label ?? selection.room);
      const scope = optionLabel(ESTIMATOR_SCOPES, selection.scope).toLowerCase();
      const quality = optionLabel(
        company.schemaVersion === 2 ? ESTIMATOR_QUALITIES : LEGACY_ESTIMATOR_QUALITIES,
        selection.quality,
      ).toLowerCase();
      const area =
        quantity > 1 && !selection.instanceId
          ? `${selection.areaM2} m² por estancia (${selection.areaM2 * quantity} m² total)`
          : `${selection.areaM2} m²`;
      return `${room}: ${scope}, calidad ${quality}, ${area}`;
    });
    const timing = LEAD_START_TIMINGS.find((option) => option.id === startTiming)?.label;
    return `Hola, me gustaría concretar esta estimación orientativa:\n${options.join('\n')}${timing ? `\nInicio previsto: ${timing}` : ''}\nHorquilla: ${formatEuro(estimate.minimumCents)}–${formatEuro(estimate.maximumCents)} (sin IVA).`;
  }, [company, estimate, selections, startTiming]);

  const servicesForRoom = (room: EstimateRoom) =>
    company?.services.filter((service) => service.room === room) ?? [];

  const createRoomSelection = (room: EstimateRoom) => {
    const available = servicesForRoom(room);
    const first = available.find((service) => service.scope === scope) ?? available[0];
    if (!first) return null;
    return {
      instanceId: crypto.randomUUID(),
      room,
      scope: company?.schemaVersion === 2 ? scope : first.scope,
      quality: first.quality,
      areaM2: room === 'fullHome' ? 70 : 10,
    } satisfies EstimateSelection;
  };

  const appendRoomInstance = (room: EstimateRoom) => {
    const selection = createRoomSelection(room);
    if (!selection) return;
    if (
      room !== 'fullHome' &&
      selections.filter((item) => item.room === room).length >= MAX_ESTIMATOR_ROOM_QUANTITY
    ) {
      setError(
        `Puedes añadir hasta ${MAX_ESTIMATOR_ROOM_QUANTITY} estancias de ${room.toLowerCase()}.`,
      );
      return;
    }
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    setSelections((current) => {
      if (room === 'fullHome') return [selection];
      if (current.some((item) => item.room === 'fullHome')) return current;
      return [...current, selection];
    });
  };

  const changeRoom = (room: EstimateRoom, checked: boolean) => {
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    if (!checked) {
      setSelections((current) => current.filter((selection) => selection.room !== room));
      return;
    }
    appendRoomInstance(room);
  };

  const changeScope = (nextScope: EstimateScope) => {
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    setScope(nextScope);
    setSelections((current) => current.map((selection) => ({ ...selection, scope: nextScope })));
  };

  const updateSelection = (
    instanceId: string,
    room: EstimateRoom,
    patch: Partial<EstimateSelection>,
  ) => {
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    setSelections((current) =>
      current.map((selection) => {
        if (selection.instanceId !== instanceId) return selection;
        const next = { ...selection, ...patch };
        if (patch.scope) {
          const matching = servicesForRoom(room).filter((service) => service.scope === patch.scope);
          if (!matching.some((service) => service.quality === next.quality))
            next.quality = matching[0]?.quality ?? next.quality;
        }
        if (patch.quality) {
          const matching = servicesForRoom(room).filter(
            (service) => service.quality === patch.quality,
          );
          if (!matching.some((service) => service.scope === next.scope))
            next.scope = matching[0]?.scope ?? next.scope;
        }
        return next;
      }),
    );
  };

  const updateContact = (patch: Partial<LeadContact>) => {
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    setContact((current) => ({ ...current, ...patch }));
  };

  const updateStartTiming = (value: LeadStartTiming | '') => {
    setError('');
    setEstimate(null);
    setSubmitted(false);
    submissionKey.current = null;
    setStartTiming(value);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company) return;
    setError('');
    setEstimate(null);
    if (selections.length === 0) {
      setError('Elige al menos una estancia para calcular la orientación.');
      return;
    }
    if (
      selections.some(
        (selection) =>
          !Number.isFinite(selection.areaM2) ||
          selection.areaM2 < 1 ||
          selection.areaM2 > 1000 ||
          !Number.isSafeInteger(selection.quantity ?? 1) ||
          (selection.quantity ?? 1) < 1 ||
          (selection.quantity ?? 1) > MAX_ESTIMATOR_ROOM_QUANTITY,
      )
    ) {
      setError(
        `Indica entre 1 y ${MAX_ESTIMATOR_ROOM_QUANTITY} estancias y una superficie entre 1 y 1000 m² por estancia.`,
      );
      return;
    }
    let normalizedContact: LeadContact | null = null;
    let normalizedStartTiming: LeadStartTiming | null = null;
    if (company.leadCaptureEnabled) {
      if (!startTiming) {
        setError('Selecciona cuándo te gustaría empezar la reforma.');
        return;
      }
      normalizedStartTiming = startTiming;
      if (!consent) {
        setError('Confirma que la empresa puede contactarte sobre esta solicitud.');
        return;
      }
      try {
        normalizedContact = validateLeadContact(contact);
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : 'Revisa tus datos de contacto.',
        );
        return;
      }
    }
    setCalculating(true);
    try {
      if (company.leadCaptureEnabled && normalizedContact && normalizedStartTiming) {
        submissionKey.current ??= crypto.randomUUID();
        const result = await requestPublicLead({
          token,
          idempotencyKey: submissionKey.current,
          contact: normalizedContact,
          selections,
          startTiming: normalizedStartTiming,
          consent: true,
          privacyPolicyUrl: company.privacyPolicyUrl ?? '',
        });
        setEstimate(result.estimate);
        setSubmitted(true);
      } else {
        const result = await requestPublicEstimate(token, selections);
        setEstimate(result);
        setSubmitted(false);
      }
    } catch {
      setError(
        company.leadCaptureEnabled
          ? 'No se ha podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.'
          : 'No se ha podido calcular esta combinación. Revisa los datos e inténtalo de nuevo.',
      );
    } finally {
      setCalculating(false);
    }
  };

  const emailHref =
    company?.email && estimate
      ? `mailto:${company.email}?subject=${encodeURIComponent('Consulta sobre reforma')}&body=${encodeURIComponent(contactSummary)}`
      : '';
  const phoneHref = company?.phone ? `tel:${company.phone.replace(/[^+\d]/g, '')}` : '';

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f3f5f1] px-4 py-6 sm:py-10" aria-busy="true">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between gap-3">
            <Brand />
            <Skeleton className="hidden h-8 w-36 rounded-full sm:block" />
          </header>
          <Skeleton className="mt-7 h-52 rounded-2xl sm:mt-9 sm:h-56" />
          <div className="mt-5 space-y-5">
            <Card className="space-y-4 p-5 sm:p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-72 max-w-full" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            </Card>
            <Card className="space-y-4 p-5 sm:p-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-14 w-full max-w-md" />
            </Card>
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  if (unavailable || !company) {
    return (
      <main className="min-h-screen bg-[#f3f5f1] px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl">
          <Brand />
          <Card className="mt-12 p-7 text-center sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <ShieldCheck size={22} />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
              Este enlace no está disponible
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Puede que haya caducado o que la empresa lo haya retirado. Ponte en contacto con la
              empresa desde su página web.
            </p>
          </Card>
          <p className="mt-6 text-center text-xs text-gray-400">Estimador de BudGenerator</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f1] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <Brand />
          <span className="hidden rounded-full border border-[#dae4dc] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#426457] sm:inline-flex">
            Orientación inicial
          </span>
        </header>

        <section className="mt-7 rounded-2xl bg-[#234c40] px-5 py-7 text-white shadow-sm sm:mt-9 sm:px-9 sm:py-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c2d5c9]">
            {company.companyName}
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Cuéntanos qué quieres renovar
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e0eae4]">
            Responde unas preguntas rápidas y recibe una horquilla orientativa según el tipo de
            reforma y la superficie.
          </p>
        </section>

        <form onSubmit={submit} className="mt-5 space-y-5">
          <section aria-labelledby="rooms-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#668175]">
                  01 · La reforma
                </p>
                <h2
                  id="rooms-title"
                  className="mt-1 text-xl font-semibold tracking-tight text-gray-900"
                >
                  ¿Qué espacio quieres renovar?
                </h2>
              </div>
              <span className="hidden text-xs text-gray-500 sm:block">Puedes elegir varios</span>
            </div>
            {company.schemaVersion === 2 && (
              <fieldset className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-medium text-gray-800">
                  ¿Qué tipo de reforma necesitas?
                </legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {ESTIMATOR_SCOPES.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm ${scope === option.id ? 'border-[#91a99b] bg-[#edf3ef] text-[#234c40]' : 'border-gray-200 text-gray-700'}`}
                    >
                      <input
                        type="radio"
                        name="public-renovation-scope"
                        value={option.id}
                        checked={scope === option.id}
                        onChange={() => changeScope(option.id)}
                        className="h-4 w-4 accent-[#426457]"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {ESTIMATOR_ROOMS.filter((room) => configuredRooms.has(room.id)).map((room) => {
                const roomSelections = selections.filter((selection) => selection.room === room.id);
                const selected = roomSelections.length > 0;
                const roomServices = servicesForRoom(room.id);
                const scopes = ESTIMATOR_SCOPES.filter((option) =>
                  roomServices.some((service) => service.scope === option.id),
                );
                const fullHomeSelected = selections.some(
                  (selection) => selection.room === 'fullHome',
                );
                const disabled =
                  room.id === 'fullHome'
                    ? selections.some((selection) => selection.room !== 'fullHome')
                    : fullHomeSelected;
                return (
                  <Card
                    key={room.id}
                    className={`overflow-hidden transition-colors ${selected ? 'border-[#91a99b] ring-1 ring-[#91a99b]/30' : ''}`}
                  >
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        disabled={disabled}
                        onChange={(event) => changeRoom(room.id, event.target.checked)}
                        className="h-4 w-4 accent-[#426457]"
                      />
                      <span className="font-medium text-gray-900">
                        {roomSelections.length > 1
                          ? `${room.pluralLabel} (${roomSelections.length})`
                          : room.label}
                      </span>
                    </label>
                    {selected && (
                      <div className="border-t border-gray-100 bg-gray-50/70 px-4">
                        {roomSelections.map((selectedRoom, index) => {
                          const instanceKey = selectedRoom.instanceId ?? `${room.id}-${index}`;
                          const roomName = `${room.label} ${index + 1}`;
                          const qualities = qualityOptions.filter((option) =>
                            roomServices.some(
                              (service) =>
                                service.scope ===
                                  (company.schemaVersion === 2 ? scope : selectedRoom.scope) &&
                                service.quality === option.id,
                            ),
                          );
                          return (
                            <div
                              key={instanceKey}
                              className="border-b border-gray-200 py-4 last:border-b-0"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold text-gray-800">{roomName}</h3>
                                {room.id !== 'fullHome' && (
                                  <button
                                    type="button"
                                    className="min-h-10 rounded-md px-3 text-sm font-medium text-gray-600 underline underline-offset-2 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426457]"
                                    aria-label={`Quitar ${room.label.toLowerCase()} ${index + 1}`}
                                    onClick={() => {
                                      setSelections((current) =>
                                        current.filter(
                                          (selection) =>
                                            selection.instanceId !== selectedRoom.instanceId,
                                        ),
                                      );
                                      setEstimate(null);
                                      setSubmitted(false);
                                      submissionKey.current = null;
                                    }}
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {company.schemaVersion === 1 && (
                                  <Select
                                    id={`scope-${instanceKey}`}
                                    label="Tipo de reforma"
                                    aria-label={`Tipo de reforma · ${roomName}`}
                                    value={selectedRoom.scope}
                                    options={scopes.map((option) => ({
                                      value: option.id,
                                      label: option.label,
                                    }))}
                                    onChange={(event) =>
                                      updateSelection(selectedRoom.instanceId ?? '', room.id, {
                                        scope: event.target.value as EstimateScope,
                                      })
                                    }
                                  />
                                )}
                                <Select
                                  id={`quality-${instanceKey}`}
                                  label="Calidad de materiales"
                                  aria-label={`Calidad · ${roomName}`}
                                  value={selectedRoom.quality}
                                  options={qualities.map((option) => ({
                                    value: option.id,
                                    label: option.label,
                                  }))}
                                  onChange={(event) =>
                                    updateSelection(selectedRoom.instanceId ?? '', room.id, {
                                      quality: event.target.value as AnyEstimateQuality,
                                    })
                                  }
                                />
                                <Input
                                  id={`area-${instanceKey}`}
                                  type="number"
                                  min="1"
                                  max="1000"
                                  step="1"
                                  label={
                                    room.id === 'fullHome'
                                      ? 'Superficie aproximada de la vivienda (m²)'
                                      : `Superficie aproximada de ${roomName.toLowerCase()} (m²)`
                                  }
                                  value={selectedRoom.areaM2}
                                  onChange={(event) =>
                                    updateSelection(selectedRoom.instanceId ?? '', room.id, {
                                      areaM2: Number(event.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                        {room.id !== 'fullHome' && (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 py-3">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={roomSelections.length >= MAX_ESTIMATOR_ROOM_QUANTITY}
                              onClick={() => appendRoomInstance(room.id)}
                            >
                              Añadir otro {room.label.toLowerCase()}
                            </Button>
                            <p className="text-xs text-gray-600">
                              {roomSelections.reduce(
                                (total, selection) =>
                                  total + selection.areaM2 * (selection.quantity ?? 1),
                                0,
                              )}{' '}
                              m² total
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            {company.schemaVersion === 2 && scope === 'integral' && (
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Añade cada estancia por separado e indica sus metros y calidad; sumaremos sus
                horquillas.
              </p>
            )}
            {company.schemaVersion === 1 &&
              selections.some((selection) => selection.room === 'fullHome') && (
                <p className="mt-2 text-xs text-gray-500">
                  La reforma integral incluye toda la vivienda y no se combina con otras estancias.
                </p>
              )}
          </section>

          {company.leadCaptureEnabled && (
            <section aria-labelledby="start-timing-title">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#668175]">
                02 · Plazo
              </p>
              <h2
                id="start-timing-title"
                className="mt-1 text-xl font-semibold tracking-tight text-gray-900"
              >
                ¿Cuándo te gustaría empezar tu reforma?
              </h2>
              <label className="mt-3 flex max-w-md flex-col gap-1 text-xs font-medium text-gray-600">
                Plazo aproximado
                <Select
                  aria-label="Plazo aproximado"
                  id="start-timing"
                  value={startTiming}
                  placeholder="Selecciona una opción"
                  options={LEAD_START_TIMINGS.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                  onChange={(event) =>
                    updateStartTiming(event.target.value as LeadStartTiming | '')
                  }
                  required
                />
              </label>
            </section>
          )}

          {company.leadCaptureEnabled && (
            <section
              aria-labelledby="contact-title"
              className="rounded-xl border border-[#dfe5df] bg-white p-4 sm:p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#668175]">
                03 · Tus datos
              </p>
              <h2
                id="contact-title"
                className="mt-1 text-xl font-semibold tracking-tight text-gray-900"
              >
                ¿Cómo podemos responderte?
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  id="lead-name"
                  label="Nombre"
                  autoComplete="name"
                  value={contact.name}
                  onChange={(event) => updateContact({ name: event.target.value })}
                  required
                />
                <Input
                  id="lead-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={contact.email}
                  onChange={(event) => updateContact({ email: event.target.value })}
                  required
                />
                <Input
                  id="lead-phone"
                  label="Teléfono"
                  type="tel"
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(event) => updateContact({ phone: event.target.value })}
                  required
                />
              </div>
              {company.privacyPolicyUrl && (
                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Consulta el{' '}
                  <a
                    href={company.privacyPolicyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#426457] underline underline-offset-2"
                  >
                    aviso de privacidad de {company.companyName}
                  </a>
                  .
                </p>
              )}
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-5 text-gray-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setEstimate(null);
                    setSubmitted(false);
                    submissionKey.current = null;
                  }}
                  className="mt-0.5 h-4 w-4 accent-[#426457]"
                  required
                />
                <span>
                  Acepto que me contacten sobre esta solicitud. No recibiré comunicaciones
                  comerciales.
                </span>
              </label>
            </section>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-gray-500">
              La estimación no sustituye una visita ni un presupuesto final.
            </p>
            <Button
              type="submit"
              disabled={submitted}
              loading={calculating}
              className="justify-center bg-[#234c40] px-5 hover:bg-[#1b3e34]"
            >
              {company.leadCaptureEnabled
                ? submitted
                  ? 'Solicitud enviada'
                  : 'Enviar solicitud y ver mi estimación'
                : 'Calcular mi horquilla'}{' '}
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>

        {estimate && (
          <section aria-labelledby="estimate-title" className="mt-6">
            <Card className="overflow-hidden border-[#cddbd1]">
              <div className="bg-[#e8f0e9] p-5 sm:p-7">
                {submitted && (
                  <p
                    role="status"
                    className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#426457]"
                  >
                    <CheckCircle2 size={17} /> Hemos recibido tu solicitud
                  </p>
                )}
                <div className="flex items-center gap-2 text-sm font-medium text-[#426457]">
                  <CheckCircle2 size={17} /> Estimación orientativa
                </div>
                <h2 id="estimate-title" className="mt-2 text-lg font-semibold text-gray-900">
                  El rango aproximado de tu reforma
                </h2>
                <p className="mt-4 font-serif text-3xl font-medium tracking-tight text-[#234c40] sm:text-4xl">
                  {formatEuro(estimate.minimumCents)}{' '}
                  <span className="px-1 text-2xl text-[#81978b]">—</span>{' '}
                  {formatEuro(estimate.maximumCents)}
                </p>
                <p className="mt-3 text-xs leading-5 text-gray-600">
                  Importe sin IVA. Puede variar tras la visita, las mediciones y la elección de
                  acabados.
                </p>
              </div>
              {(emailHref || phoneHref) && (
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-end sm:p-5">
                  {emailHref && (
                    <a
                      href={emailHref}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Mail size={16} /> Enviar consulta por correo
                    </a>
                  )}
                  {phoneHref && (
                    <a
                      href={phoneHref}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#234c40] px-4 text-sm font-medium text-white hover:bg-[#1b3e34]"
                    >
                      <Phone size={16} /> Llamar a la empresa
                    </a>
                  )}
                </div>
              )}
            </Card>
          </section>
        )}

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#dfe5df] pt-4 text-xs text-gray-500 sm:flex-row">
          <span>Preparado para {company.companyName}</span>
          <span>Estimador de BudGenerator</span>
        </footer>
      </div>
    </main>
  );
}
