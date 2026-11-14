import type {
  EstimateSelection,
  EstimatorLinkStatus,
  PublicEstimatorInfo,
  PublicLeadSubmission,
  QuoteEstimate,
  QuoteEstimatorSettings,
  QuoteLead,
  ShortLinkResolution,
} from '@bg/domain/quote-estimator/types';
import {
  runGuarded,
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';
import type { FunctionsPort } from './functionsPort.js';

export interface QuoteEstimatorRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  functions: FunctionsPort;
  guardMutation?: MutationGuard;
}

export interface HostedPrivacyNotice {
  companyName: string;
  cif: string;
  address: string;
  email: string;
  phone: string;
  updatedAt: string;
}

/** Both SDKs return a `Timestamp` with `toDate()`; older documents store ISO strings. */
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

/** Leads older than the retention period keep no contact data and are not shown in the app. */
function isAnonymized(value: Record<string, unknown>) {
  return 'anonymizedAt' in value || !value.contact;
}

/** Quote estimator settings, public link callables and leads (BG-014 D2). */
export function createQuoteEstimatorRepository({
  sdk,
  database,
  functions,
  guardMutation = unguardedMutation,
}: QuoteEstimatorRepositoryOptions) {
  const { collection, deleteDoc, doc, getDoc, getDocs, setDoc } = sdk;
  const guarded = <T>(operation: () => Promise<T>) => runGuarded(guardMutation, operation);

  function settingsDoc(uid: string) {
    return doc(database, 'users', uid, 'quoteEstimator', 'settings');
  }

  function leadsCollection(uid: string) {
    return collection(database, 'users', uid, 'leads');
  }

  async function fetchQuoteEstimatorSettings(uid: string) {
    const snapshot = await getDoc(settingsDoc(uid));
    return snapshot.exists() ? (snapshot.data() as QuoteEstimatorSettings) : null;
  }

  async function saveQuoteEstimatorSettings(uid: string, settings: QuoteEstimatorSettings) {
    await guarded(() => setDoc(settingsDoc(uid), settings));
  }

  async function deleteQuoteEstimatorSettings(uid: string) {
    await revokeEstimatorLink();
    await guarded(() => deleteDoc(settingsDoc(uid)));
  }

  async function publishEstimatorLink() {
    const call = functions.httpsCallable<void, { token: string; slug: string }>(
      'publishPublicEstimator',
    );
    return guarded(async () => (await call()).data);
  }

  async function revokeEstimatorLink() {
    const call = functions.httpsCallable<void, { revoked: boolean }>('revokePublicEstimator');
    return guarded(async () => (await call()).data);
  }

  async function fetchEstimatorLinkStatus() {
    const call = functions.httpsCallable<void, EstimatorLinkStatus>('getOwnerEstimatorStatus');
    return (await call()).data;
  }

  /** Pauses or resumes the published form; the URL does not change. */
  async function setEstimatorPaused(paused: boolean) {
    const call = functions.httpsCallable<{ paused: boolean }, { paused: boolean }>(
      'setPublicEstimatorPaused',
    );
    return guarded(async () => (await call({ paused })).data);
  }

  /** `/p/{slug}`: the active token, or the company contact when no form is published. */
  async function resolveEstimatorShortLink(slug: string) {
    const call = functions.httpsCallable<{ slug: string }, ShortLinkResolution>(
      'resolvePublicEstimatorSlug',
    );
    return (await call({ slug })).data;
  }

  /** Creates or refreshes the privacy notice hosted by BudGenerator and returns its URL. */
  async function publishHostedPrivacyNotice() {
    const call = functions.httpsCallable<void, { id: string; url: string }>('publishPrivacyNotice');
    return guarded(async () => (await call()).data);
  }

  /** Public read of a hosted privacy notice; `null` when it no longer exists. */
  async function fetchHostedPrivacyNotice(id: string): Promise<HostedPrivacyNotice | null> {
    const snapshot = await getDoc(doc(database, 'publicPrivacyNotices', id));
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

  async function fetchPublicEstimator(token: string) {
    const call = functions.httpsCallable<{ token: string }, PublicEstimatorInfo>(
      'getPublicEstimator',
    );
    return (await call({ token })).data;
  }

  async function requestPublicEstimate(token: string, selections: EstimateSelection[]) {
    const call = functions.httpsCallable<
      { token: string; selections: EstimateSelection[] },
      QuoteEstimate
    >('calculatePublicEstimate');
    return (await call({ token, selections })).data;
  }

  async function requestPublicLead(input: PublicLeadSubmission) {
    const call = functions.httpsCallable<
      PublicLeadSubmission,
      { received: true; estimate: QuoteEstimate }
    >('submitPublicLead');
    return guarded(async () => (await call(input)).data);
  }

  async function fetchLeads(uid: string): Promise<QuoteLead[]> {
    const snapshot = await getDocs(leadsCollection(uid));
    return snapshot.docs
      .filter((item) => !isAnonymized(item.data()))
      .map((item) => mapLead(item.id, item.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function fetchLead(uid: string, leadId: string): Promise<QuoteLead | null> {
    const snapshot = await getDoc(doc(leadsCollection(uid), leadId));
    return snapshot.exists() && !isAnonymized(snapshot.data())
      ? mapLead(snapshot.id, snapshot.data())
      : null;
  }

  async function deleteLead(uid: string, leadId: string) {
    await guarded(() => deleteDoc(doc(leadsCollection(uid), leadId)));
  }

  return {
    fetchQuoteEstimatorSettings,
    saveQuoteEstimatorSettings,
    deleteQuoteEstimatorSettings,
    publishEstimatorLink,
    revokeEstimatorLink,
    fetchEstimatorLinkStatus,
    setEstimatorPaused,
    resolveEstimatorShortLink,
    publishHostedPrivacyNotice,
    fetchHostedPrivacyNotice,
    fetchPublicEstimator,
    requestPublicEstimate,
    requestPublicLead,
    fetchLeads,
    fetchLead,
    deleteLead,
  };
}

export type QuoteEstimatorRepository = ReturnType<typeof createQuoteEstimatorRepository>;
