import type { BudgetAdjustment, BudgetTask } from '@/shared/types';

export type ProjectStatus = 'pending' | 'in_progress' | 'completed';
export type ProjectProgressMode = 'amount' | 'concepts';

export interface ProjectTask extends BudgetTask {
  completedAt?: string;
}

export interface ProjectWorkItem {
  id: string;
  name: string;
  position?: number;
  catalogPartId?: string;
  supplementId?: string;
  voidedAt?: string;
  tasks: ProjectTask[];
}

export interface NewProjectSupplement {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface ProjectSupplement extends NewProjectSupplement {
  id: string;
  vatRate: number;
  subtotal: number;
  iva: number;
  total: number;
  createdAt: string;
  workItemId: string;
}

export interface ProjectSupplementVoid {
  supplementId: string;
  reason: string;
  voidedAt: string;
}

export interface ProjectProgress {
  mode: ProjectProgressMode;
  totalConcepts: number;
  completedConcepts: number;
  totalAmount: number;
  completedAmount: number;
  percent: number;
  status: ProjectStatus;
}

export interface ProjectProgressHistoryPoint {
  date: string;
  percent: number;
  completedConcepts: number;
}

export interface Project {
  id: string;
  sourceBudgetId: string;
  sourceBudgetNumber: string;
  title: string;
  clientName: string;
  address: string;
  budgetDate: string;
  acceptedAt: string;
  createdAt: string;
  subtotal: number;
  iva: number;
  total: number;
  ivaRate: number;
  adjustment?: BudgetAdjustment;
  workItemCount: number;
  mode: ProjectProgressMode;
  totalConcepts: number;
  completedConcepts: number;
  totalAmount: number;
  completedAmount: number;
  percent: number;
  status: ProjectStatus;
  completedAt?: string;
  supplementsSubtotal: number;
  supplementsIva: number;
  updatedTotal: number;
  lastSupplementId?: string;
  lastSupplementAction?: 'added' | 'voided';
}

export interface ProjectDetail extends Project {
  workItems: ProjectWorkItem[];
  supplements: ProjectSupplement[];
  supplementVoids: ProjectSupplementVoid[];
}

export interface ProjectProgressMutation {
  project: Project;
  workItem: ProjectWorkItem;
}

export interface ProjectSupplementMutation {
  project: Project;
  supplement: ProjectSupplement;
  workItem: ProjectWorkItem;
}

export interface ProjectSupplementVoidMutation {
  project: Project;
  supplementVoid: ProjectSupplementVoid;
  workItem: ProjectWorkItem;
}
