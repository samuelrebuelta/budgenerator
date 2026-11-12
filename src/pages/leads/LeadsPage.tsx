import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, FileText, Mail, Phone, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/entities/auth';
import { useBudgets } from '@/entities/budget';
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
import {
  Alert,
  Button,
  buttonClassName,
  Card,
  ConfirmModal,
  EmptyState,
  OfflineUnavailable,
  PageHeader,
  PageLayout,
  PageLink,
} from '@/shared/ui';
import { notificationPathFromLeadId } from '@/features/notifications/model/navigation';
import { usePageNavigation } from '@/shared/ui/page-view-transition';
import { deleteMemoryResource, setMemoryResource } from '@/shared/lib/memoryResourceCache';
import { formatCents, formatDateTime } from '@/shared/lib';
import { useMemoryResource } from '@/shared/lib/useMemoryResource';
import { useNetworkStore } from '@/shared/model/network';

const EMPTY_LEADS: QuoteLead[] = [];

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

export function LeadsPage() {
  const uid = useAuthStore((state) => state.user?.uid);
  const online = useNetworkStore((state) => state.online);
  const budgets = useBudgets();
  const [pendingDelete, setPendingDelete] = useState<QuoteLead | null>(null);
  const { navigate } = usePageNavigation();
  const [searchParams] = useSearchParams();
  const selectedLeadHeading = useRef<HTMLHeadingElement>(null);
  const requestedLeadValues = searchParams.getAll('leadId');
  const hasRequestedLead = searchParams.has('leadId');
  const requestedLeadId =
    requestedLeadValues.length === 1 && notificationPathFromLeadId(requestedLeadValues[0])
      ? requestedLeadValues[0]
      : null;
  const resource = useMemoryResource(uid ? `private:${uid}:leads` : null, () => fetchLeads(uid!), {
    errorMessage: 'No se han podido cargar las solicitudes. Vuelve a intentarlo.',
    onLoaded: (result) => {
      for (const lead of result) setMemoryResource(`private:${uid}:lead:${lead.id}`, lead);
    },
  });
  const leads = resource.data ?? EMPTY_LEADS;
  const loading = resource.status === 'loading';
  const error = online ? resource.error : '';
  const offlineWithoutLeads =
    resource.status === 'offline' || (!online && resource.status === 'error');
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
    const nextLeads = leads.filter((lead) => lead.id !== pendingDelete.id);
    deleteMemoryResource(`private:${uid}:lead:${pendingDelete.id}`);
    resource.setData(nextLeads);
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
        <Alert tone="info" className="my-4">
          La solicitud solicitada no está disponible en esta cuenta.
        </Alert>
      )}

      {error && (
        <Alert
          tone="danger"
          className="my-4"
          action={
            <Button variant="secondary" onClick={resource.retry}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {offlineWithoutLeads ? (
        <OfflineUnavailable />
      ) : loading ? (
        <p className="py-12 text-center text-sm text-ink-subtle">Cargando solicitudes…</p>
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
                className={`p-4 sm:p-6 ${lead.id === requestedLeadId ? 'ring-2 ring-ink-subtle ring-offset-2' : ''}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2
                        ref={lead.id === requestedLeadId ? selectedLeadHeading : undefined}
                        tabIndex={lead.id === requestedLeadId ? -1 : undefined}
                        className="text-lg font-semibold text-ink focus:outline-none"
                      >
                        {lead.contact.name}
                      </h2>
                      <time className="text-sm text-ink-subtle" dateTime={lead.createdAt}>
                        {formatDateTime(lead.createdAt)}
                      </time>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
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

                    <div className="mt-4 rounded-lg bg-surface-muted p-3 sm:p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                        Reforma solicitada
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                        {lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {lead.startTiming && (
                        <p className="mt-3 text-sm text-ink-soft">
                          Inicio previsto:{' '}
                          {LEAD_START_TIMINGS.find((option) => option.id === lead.startTiming)
                            ?.label ?? lead.startTiming}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-ink-muted">Horquilla orientativa</p>
                      <p className="font-serif text-xl font-medium text-primary">
                        {formatCents(lead.estimate.minimumCents)} –{' '}
                        {formatCents(lead.estimate.maximumCents)}
                        <span className="ml-2 font-sans text-xs font-normal text-ink-subtle">
                          sin IVA
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:w-48 lg:justify-end">
                    {linkedBudget ? (
                      <PageLink
                        to={`/budget/${linkedBudget.id}`}
                        aria-label="Abrir presupuesto"
                        className={buttonClassName({ variant: 'outline' })}
                      >
                        <FileText size={16} /> Abrir presupuesto
                      </PageLink>
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
                      <p className="w-full text-right text-xs text-ink-subtle">
                        El presupuesto enlazado ya no está disponible.
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      aria-label="Borrar solicitud"
                      className="text-danger-ink hover:bg-danger-surface"
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
        <EmptyState
          icon={FileText}
          title="Aún no has recibido solicitudes"
          description="Cuando alguien envíe el formulario de tu enlace público, aquí aparecerán sus datos de contacto y lo que quiere reformar."
          action={
            <Button variant="secondary" onClick={() => navigate('/estimator')}>
              Revisar enlace público <ArrowRight size={16} aria-hidden="true" />
            </Button>
          }
        />
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
