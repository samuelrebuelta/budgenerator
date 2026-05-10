import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type { Tariff } from '@/shared/types';

function tariffsCol(uid: string) {
  return collection(db, 'users', uid, 'tariffs');
}

export async function fetchTariffs(uid: string): Promise<Tariff[]> {
  const snap = await getDocs(tariffsCol(uid));
  return snap.docs.map((d) => d.data() as Tariff);
}

export async function saveTariff(uid: string, tariff: Tariff) {
  await setDoc(doc(tariffsCol(uid), tariff.id), tariff);
}

export async function updateTariffDoc(uid: string, tariffId: string, data: Partial<Tariff>) {
  await updateDoc(doc(tariffsCol(uid), tariffId), data);
}

export async function deleteTariffDoc(uid: string, tariffId: string) {
  await deleteDoc(doc(tariffsCol(uid), tariffId));
}

export async function seedTariffs(uid: string, tariffs: Tariff[]) {
  const batch = writeBatch(db);
  for (const t of tariffs) {
    batch.set(doc(tariffsCol(uid), t.id), t);
  }
  await batch.commit();
}

export async function deleteAllTariffs(uid: string) {
  const snap = await getDocs(tariffsCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
