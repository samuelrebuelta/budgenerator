import type { Budget, BudgetTask, WorkItem } from '@/shared/types';

export interface FirestoreTask {
  id: string;
  catalogConceptId?: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  cost?: number;
}

export interface FirestoreWorkItem {
  id: string;
  name: string;
  catalogPartId?: string;
  rows?: FirestoreTask[];
  concepts?: FirestoreTask[];
  tasks?: FirestoreTask[];
}

export interface FirestoreBudget {
  id: string;
  info: Budget['info'];
  sourceLeadId?: string;
  sections?: FirestoreWorkItem[];
  workItems?: FirestoreWorkItem[];
  catalogId?: string;
  adjustment?: Budget['adjustment'];
  ivaRate?: number;
  createdAt: string;
  acceptedAt?: string;
  projectId?: string;
}

export function mapBudgetFromFirestore(raw: FirestoreBudget): Budget {
  const items = raw.workItems ?? raw.sections ?? [];
  return {
    id: raw.id,
    info: raw.info,
    ...(raw.sourceLeadId ? { sourceLeadId: raw.sourceLeadId } : {}),
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
    ...(raw.acceptedAt ? { acceptedAt: raw.acceptedAt } : {}),
    ...(raw.projectId ? { projectId: raw.projectId } : {}),
    createdAt: raw.createdAt,
  };
}

export function mapBudgetToFirestore(budget: Budget): FirestoreBudget {
  return {
    id: budget.id,
    info: budget.info,
    ...(budget.sourceLeadId ? { sourceLeadId: budget.sourceLeadId } : {}),
    workItems: budget.workItems.map((wi) => ({
      id: wi.id,
      name: wi.name,
      ...(wi.catalogPartId ? { catalogPartId: wi.catalogPartId } : {}),
      tasks: wi.tasks,
    })),
    ...(budget.adjustment ? { adjustment: budget.adjustment } : {}),
    ...(budget.catalogId ? { catalogId: budget.catalogId } : {}),
    ...(budget.ivaRate !== undefined ? { ivaRate: budget.ivaRate } : {}),
    ...(budget.acceptedAt ? { acceptedAt: budget.acceptedAt } : {}),
    ...(budget.projectId ? { projectId: budget.projectId } : {}),
    createdAt: budget.createdAt,
  };
}
