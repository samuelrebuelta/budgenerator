import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, FileText, Mail, Phone, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { useBudgetStore } from '@/entities/budget';
import {
  deleteLead,
  ESTIMATOR_QUALITIES,
  LEGACY_ESTIMATOR_QUALITIES,
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  LEAD_START_TIMINGS,
  fetchLeads,
  type QuoteLead,
} from '@/entities/quote-estimator';
import { Button, Card, ConfirmModal, PageHeader, PageLayout } from '@/shared/ui';
import { notificationPathFromLeadId } from '@/features/notifications/model/navigation';

const EMPTY_LEADS: QuoteLead[] = [];

function euro(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function optionLabel(options: readonly { id: string; label: string }[], value: string) {
  return options.find((option) => option.id === value)?.label ?? value;
}

function selectionSummary(lead: QuoteLead) {
  const roomOrdinals = new Map<string, number>();
  return lead.selections.map((selection) => {
    const roomOption = ESTIMATOR_ROOMS.find((option) => option.id === selection.room);
    const ordinal = (roomOrdinals.get(selection.room) ?? 0) + 1;
    roomOrdinals.set(selection.room, ordinal);
    const quantity = selection.quantity ?? 1;
    const room = selection.instanceId
      ? `${roomOption?.label ?? selection.room} ${ordinal}`
      : quantity > 1
        ? `${roomOption?.pluralLabel ?? selection.room} (${quantity})`
        : (roomOption?.label ?? selection.room);
    const scope = optionLabel(ESTIMATOR_SCOPES, selection.scope);
    const quality = optionLabel(
      lead.schemaVersion === 2 ? ESTIMATOR_QUALITIES : LEGACY_ESTIMATOR_QUALITIES,
      selection.quality,
    ).toLowerCase();
    const area =
      quantity > 1 && !selection.instanceId
        ? `${selection.areaM2} m² c/u (${selection.areaM2 * quantity} m² total)`
        : `${selection.areaM2} m²`;
    return `${room} · ${scope} · Calidad ${quality} · ${area}`;
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function LeadsPage() {
  const uid = useAuthStore((state) => state.user?.uid);
  const budgets = useBudgetStore((state) => state.budgets);
  const [leadState, setLeadState] = useState<{
    uid: string;
    leads: QuoteLead[];
    error?: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuoteLead | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedLeadHeading = useRef<HTMLHeadingElement>(null);
  const requestedLeadValues = searchParams.getAll('leadId');
  const hasRequestedLead = searchParams.has('leadId');
  const requestedLeadId =
    requestedLeadValues.length === 1 && notificationPathFromLeadId(requestedLeadValues[0])
      ? requestedLeadValues[0]
      : null;

  useEffect(() => {
    if (!uid) return;
    let active = true;
    fetchLeads(uid)
      .then((result) => {
        if (active) setLeadState({ uid, leads: result });
      })
      .catch(() => {
        if (active)
          setLeadState({
            uid,
            leads: [],
            error: 'No se han podido cargar las solicitudes. Vuelve a intentarlo.',
          });
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const currentState = leadState?.uid === uid ? leadState : null;
  const leads = currentState?.leads ?? EMPTY_LEADS;
  const loading = Boolean(uid) && currentState === null;
  const error = currentState?.error ?? '';
  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [leads],
  );
  const selectedLeadExists = Boolean(
    requestedLeadId && leads.some((lead) => lead.id === requestedLeadId),
  );

  useEffect(() => {
    if (!selectedLeadExists || loading) return;
    const heading = selectedLeadHeading.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [loading, requestedLeadId, selectedLeadExists]);

  const confirmDelete = async () => {
    if (!uid || !pendingDelete) return;
    await deleteLead(uid, pendingDelete.id);
    setLeadState((current) =>
      current?.uid === uid
        ? { ...current, leads: current.leads.filter((lead) => lead.id !== pendingDelete.id) }
        : current,
    );
    setPendingDelete(null);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Solicitudes recibidas"
        description="Revisa qué necesita cada cliente y continúa con un presupuesto cuando quieras."
      />

      {hasRequestedLead && !loading && !error && selectedLeadExists && (
        <p className="sr-only" role="status">
          Solicitud abierta.
        </p>
      )}
      {hasRequestedLead && !loading && !error && !selectedLeadExists && (
        <p className="field-error" role="status">
          La solicitud solicitada no está disponible en esta cuenta.
        </p>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">Cargando solicitudes…</p>
      ) : sortedLeads.length ? (
        <div className="space-y-4">
          {sortedLeads.map((lead) => {
            const linkedBudget = lead.budgetId
              ? budgets.find((budget) => budget.id === lead.budgetId)
              : undefined;
            const lines = selectionSummary(lead);
            return (
              <Card
                key={lead.id}
                className={`p-4 sm:p-6 ${lead.id === requestedLeadId ? 'ring-2 ring-[#668175] ring-offset-2' : ''}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2
                        ref={lead.id === requestedLeadId ? selectedLeadHeading : undefined}
                        tabIndex={lead.id === requestedLeadId ? -1 : undefined}
                        className="text-lg font-semibold text-gray-900 focus:outline-none"
                      >
                        {lead.contact.name}
                      </h2>
                      <time className="text-sm text-gray-500" dateTime={lead.createdAt}>
                        {formatDate(lead.createdAt)}
                      </time>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                      <a
                        href={`mailto:${lead.contact.email}`}
                        className="inline-flex items-center gap-2 underline-offset-2 hover:underline"
                      >
                        <Mail size={15} /> {lead.contact.email}
                      </a>
                      <a
                        href={`tel:${lead.contact.phone.replace(/[^+\d]/g, '')}`}
                        className="inline-flex items-center gap-2 underline-offset-2 hover:underline"
                      >
                        <Phone size={15} /> {lead.contact.phone}
                      </a>
                    </div>

                    <div className="mt-4 rounded-lg bg-[#f3f5f1] p-3 sm:p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#668175]">
                        Reforma solicitada
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm text-gray-700">
                        {lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {lead.startTiming && (
                        <p className="mt-3 text-sm text-gray-700">
                          Inicio previsto:{' '}
                          {LEAD_START_TIMINGS.find((option) => option.id === lead.startTiming)
                            ?.label ?? lead.startTiming}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-gray-600">Horquilla orientativa</p>
                      <p className="font-serif text-xl font-medium text-[#234c40]">
                        {euro(lead.estimate.minimumCents)} – {euro(lead.estimate.maximumCents)}
                        <span className="ml-2 font-sans text-xs font-normal text-gray-500">
                          sin IVA
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:w-48 lg:justify-end">
                    {linkedBudget ? (
                      <Link
                        to={`/budget/${linkedBudget.id}`}
                        aria-label="Abrir presupuesto"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#cddbd1] px-3 text-sm font-medium text-[#234c40] hover:bg-[#f3f5f1]"
                      >
                        <FileText size={16} /> Abrir presupuesto
                      </Link>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(`/budget/new?leadId=${encodeURIComponent(lead.id)}`)
                        }
                      >
                        <FileText size={16} /> Crear presupuesto
                      </Button>
                    )}
                    {lead.budgetId && !linkedBudget && (
                      <p className="w-full text-right text-xs text-gray-500">
                        El presupuesto enlazado ya no está disponible.
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      aria-label="Borrar solicitud"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => setPendingDelete(lead)}
                    >
                      <Trash2 size={16} /> Borrar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="py-14 text-center">
          <FileText className="mx-auto text-gray-400" size={34} />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Aún no has recibido solicitudes
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
            Cuando alguien envíe el formulario de tu enlace público, aquí aparecerán sus datos de
            contacto y lo que quiere reformar.
          </p>
          <Button
            className="mx-auto mt-5"
            variant="secondary"
            onClick={() => navigate('/estimator')}
          >
            Revisar enlace público <ArrowRight size={16} />
          </Button>
        </Card>
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Borrar solicitud"
        message="Se borrarán los datos de contacto y la información de la reforma. Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={confirmDelete}
      />
    </PageLayout>
  );
}
