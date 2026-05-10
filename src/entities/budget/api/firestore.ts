import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import type {
  Budget,
  BudgetTask,
  CompanyProfile,
  SharedBudget,
  WorkItem,
} from '@/shared/types';

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
      tasks: (wi.tasks ?? wi.concepts ?? wi.rows ?? []) as BudgetTask[],
    })),
    catalogId: raw.catalogId,
    adjustment: raw.adjustment,
    ivaRate: raw.ivaRate,
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
  await setDoc(doc(budgetsCol(uid), budget.id), mapToFirestore(budget));
}

export async function updateBudget(uid: string, budgetId: string, data: Partial<Budget>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await updateDoc(doc(budgetsCol(uid), budgetId), clean);
}

export async function deleteBudgetDoc(uid: string, budgetId: string) {
  await deleteDoc(doc(budgetsCol(uid), budgetId));
}

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
