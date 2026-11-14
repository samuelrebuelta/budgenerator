import { LEAD_START_TIMINGS } from '@bg/domain/quote-estimator/leads';
import {
  ESTIMATOR_QUALITIES,
  ESTIMATOR_ROOMS,
  ESTIMATOR_SCOPES,
  LEGACY_ESTIMATOR_QUALITIES,
  type QuoteLead,
} from '@bg/domain/quote-estimator/types';
import {
  notificationPathFromLeadId,
  safeNotificationLoginReturnPath,
} from '@bg/domain/notifications/navigation';

/** Memory/offline cache keys of the web's `LeadsPage` and `BudgetDetailPage`. */
export const leadsKey = (uid: string) => `private:${uid}:leads`;
export const leadKey = (uid: string, leadId: string) => `private:${uid}:lead:${leadId}`;

function optionLabel(options: readonly { id: string; label: string }[], value: string) {
  return options.find((option) => option.id === value)?.label ?? value;
}

/** «Baño 1 · Reforma integral · Calidad alta · 6 m²», as the web's `selectionSummary`. */
export function selectionSummary(lead: QuoteLead) {
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

export function startTimingLabel(lead: QuoteLead) {
  if (!lead.startTiming) return '';
  return optionLabel(LEAD_START_TIMINGS, lead.startTiming);
}

/** Filter chips. The web has none; the app adds them as in Projects (step 9). */
export type LeadFilter = '' | 'pending' | 'budgeted';

export const LEAD_FILTERS: { value: LeadFilter; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Sin presupuesto' },
  { value: 'budgeted', label: 'Con presupuesto' },
];

function searchableText(lead: QuoteLead) {
  return [lead.contact.name, lead.contact.email, lead.contact.phone, ...selectionSummary(lead)]
    .join(' ')
    .toLocaleLowerCase('es');
}

/** Newest first (web order) and filtered by the header search and the chip. */
export function filterLeads(leads: readonly QuoteLead[], search: string, filter: LeadFilter) {
  const query = search.trim().toLocaleLowerCase('es');
  return [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(
      (lead) =>
        (!filter || (filter === 'budgeted') === Boolean(lead.budgetId)) &&
        (!query || searchableText(lead).includes(query)),
    );
}

/** Same `tel:` as the web (`+` and digits only). */
export function phoneUrl(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export function emailUrl(email: string) {
  return `mailto:${email}`;
}

/**
 * WhatsApp chat (the web has no WhatsApp link: native addition). `wa.me` needs the international
 * number: a Spanish 9-digit number without prefix gets `34`; `00` becomes the international form.
 * Returns `null` when the phone has too few digits to be valid.
 */
export function whatsappUrl(phone: string) {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 9) digits = `34${digits}`;
  }
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** A lead id that the notification contract accepts (`notifications/navigation`), else `null`. */
export function validLeadId(value: unknown): string | null {
  return typeof value === 'string' && notificationPathFromLeadId(value) ? value : null;
}

/**
 * Lead id of a deep link to the web path `/profile/solicitudes?leadId=…` (custom scheme or
 * universal link). The query is rebuilt from the router params and validated with the same rules
 * as the web's login return path: exactly one `leadId`, no other keys, safe characters.
 */
export function leadIdFromDeepLink(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const path = safeNotificationLoginReturnPath(`/profile/solicitudes?${query.toString()}`);
  return path ? new URLSearchParams(path.split('?')[1]).get('leadId') : null;
}
