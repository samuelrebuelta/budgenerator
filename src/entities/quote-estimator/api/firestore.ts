import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/shared/firebase/config';
import type {
  EstimateSelection,
  PublicLeadSubmission,
  PublicEstimatorInfo,
  QuoteLead,
  QuoteEstimate,
  QuoteEstimatorSettings,
} from '../model/types';

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'quoteEstimator', 'settings');
}

export async function fetchQuoteEstimatorSettings(uid: string) {
  const snapshot = await getDoc(settingsDoc(uid));
  return snapshot.exists() ? (snapshot.data() as QuoteEstimatorSettings) : null;
}

export async function saveQuoteEstimatorSettings(uid: string, settings: QuoteEstimatorSettings) {
  await setDoc(settingsDoc(uid), settings);
}

export async function deleteQuoteEstimatorSettings(uid: string) {
  await revokeEstimatorLink();
  await deleteDoc(settingsDoc(uid));
}

export async function publishEstimatorLink() {
  const call = httpsCallable<void, { token: string }>(functions, 'publishPublicEstimator');
  return (await call()).data;
}

export async function revokeEstimatorLink() {
  const call = httpsCallable<void, { revoked: boolean }>(functions, 'revokePublicEstimator');
  return (await call()).data;
}

export async function fetchEstimatorLinkStatus() {
  const call = httpsCallable<void, { published: boolean; token?: string }>(
    functions,
    'getOwnerEstimatorStatus',
  );
  return (await call()).data;
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
  return (await call(input)).data;
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

export async function fetchLeads(uid: string): Promise<QuoteLead[]> {
  const snapshot = await getDocs(leadsCollection(uid));
  return snapshot.docs
    .map((item) => mapLead(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchLead(uid: string, leadId: string): Promise<QuoteLead | null> {
  const snapshot = await getDoc(doc(leadsCollection(uid), leadId));
  return snapshot.exists() ? mapLead(snapshot.id, snapshot.data()) : null;
}

export async function deleteLead(uid: string, leadId: string) {
  await deleteDoc(doc(leadsCollection(uid), leadId));
}
