export * from './workforce.js';
export * from './units.js';

import type { Unit } from './units.js';

/*
 * Budgets, templates and the catalog are persisted as canonical FIEBDC documents
 * (`entities/construction-document`). The interfaces below are *derived views* computed
 * from those documents for components, PDF and projects. They are never persisted.
 */

/** Derived view of an item occurrence (FIEBDC node). `id` is the node ID. */
export interface BudgetTask {
  id: string;
  conceptId: string;
  code: string;
  catalogConceptId?: string;
  description: string;
  quantity: number;
  unit: Unit;
  price: number;
  cost: number;
  /** The quantity comes from detailed measurement lines. */
  measured: boolean;
  /** The unit price is computed from a decomposition. */
  composed: boolean;
  /** Other occurrences share the same concept. */
  shared: boolean;
  text?: string;
}

/** Derived view of a chapter node. `id` is the node ID. */
export interface WorkItem {
  id: string;
  code: string;
  name: string;
  depth: number;
  catalogPartId?: string;
  tasks: BudgetTask[];
}

export interface BudgetInfo {
  clientName: string;
  address: string;
  date: string;
  budgetNumber: string;
}

export interface BudgetAdjustment {
  /** Multiplier: 1 = no change, 1.1 = +10%, 0.9 = -10% */
  multiplier: number;
  reason: string;
}

/** Derived view of a budget record and its canonical document. */
export interface Budget {
  id: string;
  info: BudgetInfo;
  workItems: WorkItem[];
  sourceLeadId?: string;
  adjustment?: BudgetAdjustment;
  ivaRate?: number;
  createdAt: string;
  acceptedAt?: string;
  projectId?: string;
}

/** Derived catalog item (a concept placed in a chapter). `id` is the concept ID. */
export interface CatalogConcept {
  id: string;
  code: string;
  description: string;
  unit: Unit;
  basePrice: number;
  cost: number;
  composed: boolean;
}

export interface Tariff extends CatalogConcept {
  category: string;
  partId: string;
}

/** Derived catalog chapter. `id` is the chapter node ID. */
export interface CatalogPart {
  id: string;
  code: string;
  name: string;
  depth: number;
  concepts: CatalogConcept[];
}

export interface CompanyProfile {
  name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  privacyPolicyUrl?: string;
  logo?: string;
}

export type PublicTask = Pick<
  BudgetTask,
  'id' | 'code' | 'description' | 'quantity' | 'unit' | 'price' | 'measured' | 'text'
>;
export type PublicBudget = Omit<Budget, 'workItems' | 'sourceLeadId'> & {
  workItems: { id: string; code: string; name: string; depth: number; tasks: PublicTask[] }[];
};

/** Derived template view. */
export interface BudgetTemplate {
  id: string;
  name: string;
  workItems: WorkItem[];
  adjustment?: BudgetAdjustment;
  ivaRate?: number;
  createdAt: string;
}

export type UserPlan = 'free' | 'premium';

export interface AccountData {
  isAdmin: boolean;
  plan: UserPlan;
  premiumExpiresAt?: string | null;
  premiumExpiresAtMillis?: number | null;
}

export interface UserData {
  uid: string;
  email: string;
  accountData: AccountData;
  totalBudgetsCreated: number;
  lastCreatedBudgetId?: string;
  budgetSlotsReleased?: number;
  lastConvertedBudgetId?: string;
  createdAt: string;
}

export * from './notifications.js';
