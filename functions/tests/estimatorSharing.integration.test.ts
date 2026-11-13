import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  calculatePublicEstimate,
  getOwnerEstimatorStatus,
  getPublicEstimator,
  publishPublicEstimator,
  resolvePublicEstimatorSlug,
  revokePublicEstimator,
  setPublicEstimatorPaused,
  slugCandidates,
} from '../src/quoteEstimator';
import { publishPrivacyNotice } from '../src/privacyNotice';
import { deleteAccountData, exportAccountData } from '../src/account/account';

const auth = getAuth();
const firestore = getFirestore();

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Estimator sharing integration tests require Auth and Firestore emulators.');
});

const selection = {
  instanceId: '11111111-1111-4111-8111-111111111111',
  room: 'bathroom',
  scope: 'partial',
  quality: 'medium',
  areaM2: 6,
  quantity: 1,
};

async function seedOwner(name = `Reformas Prueba ${randomUUID().slice(0, 6)}`) {
  const uid = `sharing-${randomUUID()}`;
  await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  await firestore.doc(`users/${uid}/profile/data`).set({
    name,
    cif: 'B12345678',
    address: 'Calle Prueba 1, Madrid',
    phone: '600111222',
    email: `${uid}@example.test`,
    privacyPolicyUrl: 'https://example.test/privacidad',
  });
  await firestore.doc(`users/${uid}/quoteEstimator/settings`).set({
    schemaVersion: 2,
    rooms: [
      {
        room: 'bathroom',
        minimumCentsPerM2: 60_000,
        maximumCentsPerM2: 90_000,
        qualityStepCentsPerM2: 10_000,
      },
    ],
    contact: { sharePhone: true, shareEmail: false },
  });
  return { uid, name };
}

describe('short links', () => {
  it('derives readable candidates and falls back to a generic stem', () => {
    expect(slugCandidates('Reformas García, S.L.')[0]).toBe('reformas-garcia');
    expect(slugCandidates('Reformas García, S.L.')[1]).toBe('reformas-garcia-2');
    expect(slugCandidates('***')[0]).toBe('empresa');
  });

  it('keeps one stable slug across revoke and republish and shows the contact meanwhile', async () => {
    const { uid } = await seedOwner('Reformas Enlace Corto');
    const first = await publishPublicEstimator(uid);
    expect(first.slug).toMatch(/^reformas-enlace-corto/);
    await expect(resolvePublicEstimatorSlug({ slug: first.slug })).resolves.toEqual({
      token: first.token,
    });

    await revokePublicEstimator(uid);
    await expect(resolvePublicEstimatorSlug({ slug: first.slug })).resolves.toEqual({
      company: { companyName: 'Reformas Enlace Corto', phone: '600111222' },
    });

    const second = await publishPublicEstimator(uid);
    expect(second.slug).toBe(first.slug);
    expect(second.token).not.toBe(first.token);
    await expect(resolvePublicEstimatorSlug({ slug: first.slug })).resolves.toEqual({
      token: second.token,
    });
    await deleteAccountData(uid);
  });

  it('gives a second company with the same name its own slug', async () => {
    const a = await seedOwner('Reformas Iguales');
    const b = await seedOwner('Reformas Iguales');
    const [first, second] = [
      await publishPublicEstimator(a.uid),
      await publishPublicEstimator(b.uid),
    ];
    expect(first.slug).not.toBe(second.slug);
    await Promise.all([deleteAccountData(a.uid), deleteAccountData(b.uid)]);
  });

  it('rejects malformed and unknown slugs as unavailable', async () => {
    await expect(resolvePublicEstimatorSlug({ slug: '../x' })).rejects.toMatchObject({
      code: 'not-found',
    });
    await expect(
      resolvePublicEstimatorSlug({ slug: `no-existe-${randomUUID().slice(0, 8)}` }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('pause', () => {
  it('keeps the URL, shows the contact and blocks estimates while paused', async () => {
    const { uid } = await seedOwner();
    const { token } = await publishPublicEstimator(uid);
    await expect(setPublicEstimatorPaused(uid, { paused: true })).resolves.toEqual({
      paused: true,
    });
    await expect(getOwnerEstimatorStatus(uid)).resolves.toMatchObject({
      published: true,
      token,
      paused: true,
    });
    const info = await getPublicEstimator({ token });
    expect(info).toMatchObject({ paused: true, services: [], leadCaptureEnabled: false });
    expect(info.phone).toBe('600111222');
    await expect(
      calculatePublicEstimate({ token, selections: [selection] } as never),
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    await setPublicEstimatorPaused(uid, { paused: false });
    const resumed = await getPublicEstimator({ token });
    expect(resumed.paused).toBeUndefined();
    await expect(
      calculatePublicEstimate({ token, selections: [selection] } as never),
    ).resolves.toMatchObject({ minimumCents: 360_000, maximumCents: 540_000 });
    await deleteAccountData(uid);
  });

  it('refuses to pause without a published form or with an invalid value', async () => {
    const { uid } = await seedOwner();
    await expect(setPublicEstimatorPaused(uid, { paused: true })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    await expect(setPublicEstimatorPaused(uid, { paused: 'yes' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await deleteAccountData(uid);
  });
});

describe('hosted privacy notice', () => {
  it('publishes a snapshot without the owner UID, refreshes it and cleans it up', async () => {
    const { uid, name } = await seedOwner();
    const first = await publishPrivacyNotice(uid);
    expect(first.url).toMatch(new RegExp(`^https://.+/aviso-privacidad/${first.id}$`));
    const notice = (await firestore.doc(`publicPrivacyNotices/${first.id}`).get()).data()!;
    expect(notice).toMatchObject({ companyName: name, cif: 'B12345678' });
    expect(Object.keys(notice)).not.toContain('ownerUid');

    await firestore.doc(`users/${uid}/profile/data`).update({ name: 'Nombre Nuevo' });
    const second = await publishPrivacyNotice(uid);
    expect(second.id).toBe(first.id);
    expect((await firestore.doc(`publicPrivacyNotices/${first.id}`).get()).get('companyName')).toBe(
      'Nombre Nuevo',
    );

    await publishPublicEstimator(uid);
    const exported = await exportAccountData(uid);
    const paths = exported.documents.map((document) => document.path);
    expect(paths).toContain(`publicPrivacyNotices/${first.id}`);
    expect(paths.some((path) => path.startsWith('publicQuoteSlugs/'))).toBe(true);

    await deleteAccountData(uid);
    expect((await firestore.doc(`publicPrivacyNotices/${first.id}`).get()).exists).toBe(false);
    expect((await firestore.doc(`privacyNoticeOwners/${uid}`).get()).exists).toBe(false);
    const slugs = await firestore.collection('publicQuoteSlugs').where('ownerUid', '==', uid).get();
    expect(slugs.empty).toBe(true);
  });

  it('needs a company name and a way to exercise rights', async () => {
    const { uid } = await seedOwner();
    await firestore.doc(`users/${uid}/profile/data`).update({ email: '', address: '' });
    await expect(publishPrivacyNotice(uid)).rejects.toMatchObject({ code: 'failed-precondition' });
    await deleteAccountData(uid);
  });
});
