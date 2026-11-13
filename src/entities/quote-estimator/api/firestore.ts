import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/shared/firebase/config';
import { runNetworkMutation } from '@/shared/lib/networkMutation';
import type {
  EstimateSelection,
  EstimatorLinkStatus,
  PublicLeadSubmission,
  PublicEstimatorInfo,
  QuoteLead,
  QuoteEstimate,
  QuoteEstimatorSettings,
  ShortLinkResolution,
} from '../model/types';

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'quoteEstimator', 'settings');
}

export async function fetchQuoteEstimatorSettings(uid: string) {
  const snapshot = await getDoc(settingsDoc(uid));
  return snapshot.exists() ? (snapshot.data() as QuoteEstimatorSettings) : null;
}

export async function saveQuoteEstimatorSettings(uid: string, settings: QuoteEstimatorSettings) {
  await runNetworkMutation(() => setDoc(settingsDoc(uid), settings));
}

export async function deleteQuoteEstimatorSettings(uid: string) {
  await revokeEstimatorLink();
  await runNetworkMutation(() => deleteDoc(settingsDoc(uid)));
}

export async function publishEstimatorLink() {
  const call = httpsCallable<void, { token: string; slug: string }>(
    functions,
    'publishPublicEstimator',
  );
  return runNetworkMutation(async () => (await call()).data);
}

export async function revokeEstimatorLink() {
  const call = httpsCallable<void, { revoked: boolean }>(functions, 'revokePublicEstimator');
  return runNetworkMutation(async () => (await call()).data);
}

export async function fetchEstimatorLinkStatus() {
  const call = httpsCallable<void, EstimatorLinkStatus>(functions, 'getOwnerEstimatorStatus');
  return (await call()).data;
}

/** Pauses or resumes the published form; the URL does not change. */
export async function setEstimatorPaused(paused: boolean) {
  const call = httpsCallable<{ paused: boolean }, { paused: boolean }>(
    functions,
    'setPublicEstimatorPaused',
  );
  return runNetworkMutation(async () => (await call({ paused })).data);
}

/** `/p/{slug}`: the active token, or the company contact when no form is published. */
export async function resolveEstimatorShortLink(slug: string) {
  const call = httpsCallable<{ slug: string }, ShortLinkResolution>(
    functions,
    'resolvePublicEstimatorSlug',
  );
  return (await call({ slug })).data;
}

/** Creates or refreshes the privacy notice hosted by BudGenerator and returns its URL. */
export async function publishHostedPrivacyNotice() {
  const call = httpsCallable<void, { id: string; url: string }>(functions, 'publishPrivacyNotice');
  return runNetworkMutation(async () => (await call()).data);
}

export interface HostedPrivacyNotice {
  companyName: string;
  cif: string;
  address: string;
  email: string;
  phone: string;
  updatedAt: string;
}

/** Public read of a hosted privacy notice; `null` when it no longer exists. */
export async function fetchHostedPrivacyNotice(id: string): Promise<HostedPrivacyNotice | null> {
  const snapshot = await getDoc(doc(db, 'publicPrivacyNotices', id));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const textField = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '');
  return {
    companyName: textField('companyName'),
    cif: textField('cif'),
    address: textField('address'),
    email: textField('email'),
    phone: textField('phone'),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function fetchPublicEstimator(token: string) {
  const call = httpsCallable<{ token: string }, PublicEstimatorInfo>(
    functions,
    'getPublicEstimator',
  );
  return (await call({ token })).data;
}

export async function requestPublicEstimate(token: string, selections: EstimateSelection[]) {
  const call = httpsCallable<{ token: string; selections: EstimateSelection[] }, QuoteEstimate>(
    functions,
    'calculatePublicEstimate',
  );
  return (await call({ token, selections })).data;
}

export async function requestPublicLead(input: PublicLeadSubmission) {
  const call = httpsCallable<PublicLeadSubmission, { received: true; estimate: QuoteEstimate }>(
    functions,
    'submitPublicLead',
  );
  return runNetworkMutation(async () => (await call(input)).data);
}

function toIsoDate(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate.call(value).toISOString();
  }
  return '';
}

function mapLead(id: string, value: Record<string, unknown>): QuoteLead {
  return {
    ...(value as unknown as Omit<QuoteLead, 'id' | 'createdAt' | 'consentAt'>),
    id,
    createdAt: toIsoDate(value.createdAt),
    consentAt: toIsoDate(value.consentAt),
  };
}

function leadsCollection(uid: string) {
  return collection(db, 'users', uid, 'leads');
}

/** Leads older than the retention period keep no contact data and are not shown in the app. */
function isAnonymized(value: Record<string, unknown>) {
  return 'anonymizedAt' in value || !value.contact;
}

export async function fetchLeads(uid: string): Promise<QuoteLead[]> {
  const snapshot = await getDocs(leadsCollection(uid));
  return snapshot.docs
    .filter((item) => !isAnonymized(item.data()))
    .map((item) => mapLead(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchLead(uid: string, leadId: string): Promise<QuoteLead | null> {
  const snapshot = await getDoc(doc(leadsCollection(uid), leadId));
  return snapshot.exists() && !isAnonymized(snapshot.data())
    ? mapLead(snapshot.id, snapshot.data())
    : null;
}

export async function deleteLead(uid: string, leadId: string) {
  await runNetworkMutation(() => deleteDoc(doc(leadsCollection(uid), leadId)));
}
