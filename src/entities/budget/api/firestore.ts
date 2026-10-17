import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '@/shared/firebase/config';
import { assertBudget } from '@/shared/lib/budgetMath';
import { toPublicBudget } from '../model/publicBudget';
import type {
  Budget,
  BudgetTask,
  CompanyProfile,
  SharedBudget,
  WorkItem,
  UserData,
} from '@/shared/types';

interface FirestoreTask {
  id: string;
  catalogConceptId?: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  cost: number;
}

interface FirestoreWorkItem {
  id: string;
  name: string;
  catalogPartId?: string;
  rows?: FirestoreTask[];
  concepts?: FirestoreTask[];
  tasks?: FirestoreTask[];
}

interface FirestoreBudget {
  id: string;
  info: Budget['info'];
  sections?: FirestoreWorkItem[];
  workItems?: FirestoreWorkItem[];
  catalogId?: string;
  adjustment?: Budget['adjustment'];
  ivaRate?: number;
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
      ...(wi.catalogPartId ? { catalogPartId: wi.catalogPartId } : {}),
      tasks: (wi.tasks ?? wi.concepts ?? wi.rows ?? []).map((task) => ({
        ...task,
        cost: task.cost ?? 0,
      })) as BudgetTask[],
    })),
    ...(raw.catalogId ? { catalogId: raw.catalogId } : {}),
    ...(raw.adjustment ? { adjustment: raw.adjustment } : {}),
    ...(raw.ivaRate !== undefined ? { ivaRate: raw.ivaRate } : {}),
    createdAt: raw.createdAt,
  };
}

function mapToFirestore(budget: Budget): FirestoreBudget {
  const data: FirestoreBudget = {
    id: budget.id,
    info: budget.info,
    workItems: budget.workItems.map((wi) => ({
      id: wi.id,
      name: wi.name,
      ...(wi.catalogPartId ? { catalogPartId: wi.catalogPartId } : {}),
      tasks: wi.tasks,
    })),
    createdAt: budget.createdAt,
  };
  if (budget.adjustment) {
    data.adjustment = budget.adjustment;
  }
  if (budget.catalogId) {
    data.catalogId = budget.catalogId;
  }
  if (budget.ivaRate !== undefined) {
    data.ivaRate = budget.ivaRate;
  }
  return data;
}

function budgetsCol(uid: string) {
  return collection(db, 'users', uid, 'budgets');
}

export async function fetchBudgets(uid: string): Promise<Budget[]> {
  const snap = await getDocs(budgetsCol(uid));
  return snap.docs.map((d) => mapFromFirestore(d.data() as FirestoreBudget));
}

export async function saveBudget(uid: string, budget: Budget) {
  assertBudget(budget);
  // Updates never recreate a document that has already been deleted.
  await updateDoc(doc(budgetsCol(uid), budget.id), {
    ...mapToFirestore(budget),
    adjustment: budget.adjustment ?? deleteField(),
    catalogId: budget.catalogId ?? deleteField(),
  });
}

export async function updateBudget(uid: string, budgetId: string, data: Partial<Budget>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await updateDoc(doc(budgetsCol(uid), budgetId), clean);
}

export async function deleteBudgetDoc(uid: string, budgetId: string) {
  await deleteDoc(doc(budgetsCol(uid), budgetId));
}

export async function createBudget(uid: string, budget: Budget): Promise<UserData> {
  assertBudget(budget);
  return runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', uid);
    const budgetRef = doc(budgetsCol(uid), budget.id);
    const [userSnap, existing] = await Promise.all([
      transaction.get(userRef),
      transaction.get(budgetRef),
    ]);
    if (!userSnap.exists()) throw new Error('No se ha podido cargar tu cuenta.');
    const user = userSnap.data() as UserData;
    if (existing.exists()) return user; // Retry the same creation id without charging quota twice.
    const account = user.accountData;
    const premium =
      account.plan === 'premium' &&
      (!account.premiumExpiresAt || Date.parse(account.premiumExpiresAt) > Date.now());
    if (!premium && user.totalBudgetsCreated >= 3)
      throw new Error('Has alcanzado el límite de tu plan.');
    const updated = {
      ...user,
      totalBudgetsCreated: user.totalBudgetsCreated + 1,
      lastCreatedBudgetId: budget.id,
    };
    transaction.set(budgetRef, mapToFirestore(budget));
    transaction.update(userRef, {
      totalBudgetsCreated: updated.totalBudgetsCreated,
      lastCreatedBudgetId: budget.id,
    });
    return updated;
  });
}

export async function shareBudget(budget: Budget, company: CompanyProfile): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Inicia sesión para compartir.');
  assertBudget(budget, true);
  const token = crypto.randomUUID();
  const shared: SharedBudget = {
    schemaVersion: 2,
    ownerUid: uid,
    expiresAt: Date.now() + 30 * 86400000,
    budget: toPublicBudget(budget),
    company: {
      name: company.name,
      cif: company.cif,
      address: company.address,
      phone: company.phone,
      email: company.email,
      ...(company.logo ? { logo: company.logo } : {}),
    },
    ivaRate: budget.ivaRate ?? 0.1,
    sharedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'sharedBudgets', token), shared);
  return token;
}
export async function revokeSharedBudget(token: string) {
  await deleteDoc(doc(db, 'sharedBudgets', token));
}
export async function fetchSharedBudget(token: string): Promise<SharedBudget | null> {
  const snap = await getDoc(doc(db, 'sharedBudgets', token));
  if (!snap.exists()) return null;
  const shared = snap.data() as SharedBudget;
  if (shared.schemaVersion !== 2 || shared.expiresAt <= Date.now()) return null;
  return shared;
}
