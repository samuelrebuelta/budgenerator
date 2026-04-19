import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Budget, Tariff, CompanyProfile } from '@/shared/types';

// --- Budgets ---

function budgetsCol(uid: string) {
  return collection(db, 'users', uid, 'budgets');
}

export async function fetchBudgets(uid: string): Promise<Budget[]> {
  const snap = await getDocs(budgetsCol(uid));
  return snap.docs.map((d) => d.data() as Budget);
}

export async function saveBudget(uid: string, budget: Budget) {
  await setDoc(doc(budgetsCol(uid), budget.id), budget);
}

export async function updateBudget(uid: string, budgetId: string, data: Partial<Budget>) {
  await updateDoc(doc(budgetsCol(uid), budgetId), data);
}

export async function deleteBudgetDoc(uid: string, budgetId: string) {
  await deleteDoc(doc(budgetsCol(uid), budgetId));
}

// --- Tariffs ---

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

// --- Company Profile ---

function profileDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'profile');
}

export async function fetchProfile(uid: string): Promise<CompanyProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  return snap.exists() ? (snap.data() as CompanyProfile) : null;
}

export async function saveProfile(uid: string, profile: CompanyProfile) {
  await setDoc(profileDoc(uid), profile);
}
