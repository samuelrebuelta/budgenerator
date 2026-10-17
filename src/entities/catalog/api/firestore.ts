import {
  collection,
  runTransaction,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { Tariff, TariffCatalog } from '@/shared/types';
import { catalogParts } from '../model/migrate';

function legacyTariffsCol(uid: string) {
  return collection(db, 'users', uid, 'tariffs');
}

function catalogsCol(uid: string) {
  return collection(db, 'users', uid, 'tariffCatalogs');
}

function activeCatalogDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'tariffCatalog');
}

export async function fetchLegacyTariffs(uid: string): Promise<Tariff[]> {
  const snap = await getDocs(legacyTariffsCol(uid));
  return snap.docs.map((d) => d.data() as Tariff);
}

export async function deleteLegacyTariffs(uid: string) {
  const snap = await getDocs(legacyTariffsCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function fetchTariffCatalogs(uid: string): Promise<TariffCatalog[]> {
  const snap = await getDocs(catalogsCol(uid));
  return snap.docs.map((d) => d.data() as TariffCatalog);
}

export async function saveTariffCatalog(uid: string, catalog: TariffCatalog) {
  await setDoc(doc(catalogsCol(uid), catalog.id), catalog);
}

export async function updateTariffCatalogDoc(
  uid: string,
  catalogId: string,
  data: Partial<TariffCatalog>,
) {
  await updateDoc(doc(catalogsCol(uid), catalogId), data);
}

export async function deleteTariffCatalogDoc(uid: string, catalogId: string) {
  await deleteDoc(doc(catalogsCol(uid), catalogId));
}

export async function fetchActiveTariffCatalogId(uid: string): Promise<string | null> {
  const snap = await getDoc(activeCatalogDoc(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { activeCatalogId?: string | null };
  return data.activeCatalogId ?? null;
}

export async function saveActiveTariffCatalogId(uid: string, catalogId: string | null) {
  await setDoc(activeCatalogDoc(uid), { activeCatalogId: catalogId }, { merge: true });
}

/** The fixed destination is read inside the transaction: concurrent tabs never overwrite it. */
export async function ensureSingleCatalog(
  uid: string,
  initial: TariffCatalog,
): Promise<TariffCatalog> {
  return runTransaction(db, async (transaction) => {
    const ref = doc(catalogsCol(uid), 'main-v1');
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists() ? (snapshot.data() as TariffCatalog) : initial;
    const catalog = { ...stored, parts: catalogParts(stored) };
    delete catalog.tariffs;
    if (!snapshot.exists() || 'tariffs' in stored) transaction.set(ref, catalog as TariffCatalog);
    transaction.set(activeCatalogDoc(uid), { activeCatalogId: catalog.id }, { merge: true });
    return catalog;
  });
}
