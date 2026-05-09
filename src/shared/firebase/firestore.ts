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
import type { Budget, Tariff, CompanyProfile, WorkItem, BudgetTask, SharedBudget, BudgetTemplate, UserData, UserPlan } from '@/shared/types';

// --- Firestore ↔ App field mapping ---
// Firestore stores: sections[].rows[] (legacy) / sections[].concepts[]
// App uses: workItems[].tasks[]

interface FirestoreTask {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  cost: number;
}

interface FirestoreWorkItem {
  id: string;
  name: string;
  rows?: FirestoreTask[];
  concepts?: FirestoreTask[];
  tasks?: FirestoreTask[];
}

interface FirestoreBudget {
  id: string;
  info: Budget['info'];
  sections?: FirestoreWorkItem[];
  workItems?: FirestoreWorkItem[];
  adjustment?: Budget['adjustment'];
  createdAt: string;
}

function mapFromFirestore(raw: FirestoreBudget): Budget {
  const items = raw.workItems ?? raw.sections ?? [];
  return {
    id: raw.id,
    info: raw.info,
    workItems: items.map((wi): WorkItem => ({
      id: wi.id,
      name: wi.name,
      tasks: (wi.tasks ?? wi.concepts ?? wi.rows ?? []) as BudgetTask[],
    })),
    adjustment: raw.adjustment,
    createdAt: raw.createdAt,
  };
}

function mapToFirestore(budget: Budget): FirestoreBudget {
  return {
    id: budget.id,
    info: budget.info,
    workItems: budget.workItems.map((wi) => ({
      id: wi.id,
      name: wi.name,
      tasks: wi.tasks,
    })),
    adjustment: budget.adjustment,
    createdAt: budget.createdAt,
  };
}

// --- Budgets ---

function budgetsCol(uid: string) {
  return collection(db, 'users', uid, 'budgets');
}

export async function fetchBudgets(uid: string): Promise<Budget[]> {
  const snap = await getDocs(budgetsCol(uid));
  return snap.docs.map((d) => mapFromFirestore(d.data() as FirestoreBudget));
}

export async function saveBudget(uid: string, budget: Budget) {
  await setDoc(doc(budgetsCol(uid), budget.id), mapToFirestore(budget));
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
  return doc(db, 'users', uid, 'profile', 'data');
}

// Legacy path (pre-migration)
function legacyProfileDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'profile');
}

export async function fetchProfile(uid: string): Promise<CompanyProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  if (snap.exists()) return snap.data() as CompanyProfile;

  // Migrate from legacy path if it exists
  const legacySnap = await getDoc(legacyProfileDoc(uid));
  if (legacySnap.exists()) {
    const data = legacySnap.data() as CompanyProfile;
    await setDoc(profileDoc(uid), data);
    await deleteDoc(legacyProfileDoc(uid));
    return data;
  }

  return null;
}

export async function saveProfile(uid: string, profile: CompanyProfile) {
  await setDoc(profileDoc(uid), profile);
}

// --- Shared Budgets (public, no auth required) ---

export async function shareBudget(budget: Budget, company: CompanyProfile): Promise<string> {
  const token = crypto.randomUUID();
  const shared: SharedBudget = {
    budget,
    company,
    ivaRate: budget.ivaRate ?? 0.10,
    sharedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'sharedBudgets', token), shared);
  return token;
}

export async function fetchSharedBudget(token: string): Promise<SharedBudget | null> {
  const snap = await getDoc(doc(db, 'sharedBudgets', token));
  return snap.exists() ? (snap.data() as SharedBudget) : null;
}

// --- Budget Templates (user-scoped) ---

function templatesCol(uid: string) {
  return collection(db, 'users', uid, 'templates');
}

export async function fetchTemplates(uid: string): Promise<BudgetTemplate[]> {
  const snap = await getDocs(templatesCol(uid));
  return snap.docs.map((d) => d.data() as BudgetTemplate);
}

export async function saveTemplate(uid: string, template: BudgetTemplate) {
  await setDoc(doc(templatesCol(uid), template.id), template);
}

export async function deleteTemplatDoc(uid: string, templateId: string) {
  await deleteDoc(doc(templatesCol(uid), templateId));
}

// --- User Data ---
// Stored at users/{uid} (root document) so admin can list all users

function userDataDoc(uid: string) {
  return doc(db, 'users', uid);
}

// Legacy path (pre-migration)
function legacyUserDataDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'userData');
}

export async function fetchUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(userDataDoc(uid));
  if (snap.exists()) {
    const data = snap.data();
    if (data.accountData) return data as UserData;
  }

  // Migrate from legacy path if it exists
  const legacySnap = await getDoc(legacyUserDataDoc(uid));
  if (legacySnap.exists()) {
    const data = legacySnap.data() as UserData;
    if (data.accountData) {
      await setDoc(userDataDoc(uid), data, { merge: true });
      await deleteDoc(legacyUserDataDoc(uid));
      return data;
    }
  }

  return null;
}

export async function saveUserData(uid: string, data: UserData) {
  await setDoc(userDataDoc(uid), data, { merge: true });
}

export async function updateUserData(uid: string, data: Partial<UserData>) {
  await updateDoc(userDataDoc(uid), data);
}

export async function incrementBudgetCount(uid: string) {
  const data = await fetchUserData(uid);
  if (data) {
    await updateDoc(userDataDoc(uid), { totalBudgetsCreated: data.totalBudgetsCreated + 1 });
  }
}

// --- Admin: list all users ---

export async function fetchAllUsers(): Promise<UserData[]> {
  const usersCol = collection(db, 'users');
  const usersSnap = await getDocs(usersCol);
  const results: UserData[] = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();

    // Already migrated — has accountData in root doc
    if (data.accountData) {
      results.push(data as UserData);
      continue;
    }

    // Check legacy path and migrate if found
    const legacyRef = doc(db, 'users', userDoc.id, 'settings', 'userData');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const legacyData = legacySnap.data() as UserData;
      if (legacyData.accountData) {
        await setDoc(userDataDoc(userDoc.id), legacyData, { merge: true });
        await deleteDoc(legacyRef);
        results.push(legacyData);
      }
    }
  }

  return results;
}

export async function adminUpdateUserPlan(uid: string, plan: UserPlan) {
  await updateDoc(doc(db, 'users', uid), { 'accountData.plan': plan });
}
