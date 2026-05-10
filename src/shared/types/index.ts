export type Unit = 'm2' | 'm3' | 'ml' | 'unit' | 'hour';

export const UNIT_LABELS: Record<Unit, string> = {
  m2: 'M²',
  m3: 'M³',
  ml: 'ML',
  unit: 'Ud.',
  hour: 'Hr',
};

export interface BudgetTask {
  id: string;
  description: string;
  quantity: number;
  unit: Unit;
  price: number;
  cost: number;
}

export interface WorkItem {
  id: string;
  name: string;
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

export interface Budget {
  id: string;
  info: BudgetInfo;
  workItems: WorkItem[];
  catalogId?: string;
  adjustment?: BudgetAdjustment;
  ivaRate?: number;
  createdAt: string;
}

export interface Tariff {
  id: string;
  description: string;
  unit: Unit;
  basePrice: number;
  cost: number;
  category: string;
}

export interface TariffCatalog {
  id: string;
  name: string;
  baseCatalogId?: string;
  tariffs: Tariff[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface SharedBudget {
  budget: Budget;
  company: CompanyProfile;
  ivaRate: number;
  sharedAt: string;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  workItems: WorkItem[];
  catalogId?: string;
  adjustment?: BudgetAdjustment;
  createdAt: string;
}

export type UserPlan = 'free' | 'premium';

export interface AccountData {
  isAdmin: boolean;
  plan: UserPlan;
  premiumExpiresAt?: string;
}

export interface UserData {
  uid: string;
  email: string;
  accountData: AccountData;
  totalBudgetsCreated: number;
  createdAt: string;
}
