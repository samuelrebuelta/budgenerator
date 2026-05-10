import {
  collection,
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

export async function updateTariffCatalogDoc(uid: string, catalogId: string, data: Partial<TariffCatalog>) {
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
