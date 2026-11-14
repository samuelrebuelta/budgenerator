import { randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CompanyProfile } from './domain.js';

if (getApps().length === 0) initializeApp();
const firestore = getFirestore();

/** Public, read-only notices: `publicPrivacyNotices/{id}`. They never store the owner's UID. */
export const PRIVACY_NOTICE_COLLECTION = 'publicPrivacyNotices';
/** Server-only map from owner to notice, used to update, export and delete it. */
export const PRIVACY_NOTICE_OWNER_COLLECTION = 'privacyNoticeOwners';
const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN || 'https://budgenerator.web.app';
const idPattern = /^[A-Za-z0-9_-]{22}$/;

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function privacyNoticeUrl(id: string) {
  return `${PUBLIC_APP_ORIGIN}/aviso-privacidad/${id}`;
}

/**
 * Creates or refreshes the hosted privacy notice of a company that has no website, with a
 * snapshot of its current profile. The client stores the returned URL in the profile.
 */
export async function publishPrivacyNotice(uid: string) {
  const profile = (await firestore.doc(`users/${uid}/profile/data`).get()).data() as
    Partial<CompanyProfile> | undefined;
  const companyName = text(profile?.name, 100);
  if (!companyName)
    throw new HttpsError('failed-precondition', 'Completa primero el nombre de empresa.');
  const email = text(profile?.email, 254);
  const address = text(profile?.address, 300);
  if (!email && !address)
    throw new HttpsError(
      'failed-precondition',
      'Añade un email o una dirección en Mi empresa para que puedan ejercer sus derechos.',
    );
  const ownerRef = firestore.doc(`${PRIVACY_NOTICE_OWNER_COLLECTION}/${uid}`);
  const current = (await ownerRef.get()).data() as { id?: string } | undefined;
  const id =
    current?.id && idPattern.test(current.id) ? current.id : randomBytes(16).toString('base64url');
  const batch = firestore.batch();
  batch.set(firestore.doc(`${PRIVACY_NOTICE_COLLECTION}/${id}`), {
    schemaVersion: 1,
    companyName,
    cif: text(profile?.cif, 20),
    address,
    email,
    phone: text(profile?.phone, 40),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(ownerRef, { id, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { id, url: privacyNoticeUrl(id) };
}

/** Notice id of an owner, for account export and deletion. */
export async function findOwnerPrivacyNotice(uid: string) {
  const id = (
    (await firestore.doc(`${PRIVACY_NOTICE_OWNER_COLLECTION}/${uid}`).get()).data() as
      { id?: string } | undefined
  )?.id;
  return id && idPattern.test(id) ? id : null;
}
