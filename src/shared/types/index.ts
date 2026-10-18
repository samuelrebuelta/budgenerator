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
  catalogConceptId?: string;
  description: string;
  quantity: number;
  unit: Unit;
  price: number;
  cost: number;
}

export interface WorkItem {
  id: string;
  name: string;
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

export interface Budget {
  id: string;
  info: BudgetInfo;
  workItems: WorkItem[];
  sourceLeadId?: string;
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
  /** Membership in the catalog tree; populated on flattened client views. */
  partId?: string;
}

export type CatalogConcept = Omit<Tariff, 'category' | 'partId'>;

export interface CatalogPart {
  id: string;
  name: string;
  concepts: CatalogConcept[];
}

export interface TariffCatalog {
  id: string;
  name: string;
  baseCatalogId?: string;
  parts: CatalogPart[];
  /** Legacy flat representation; accepted only while reading older catalogs. */
  tariffs?: Tariff[];
  createdAt: string;
  updatedAt: string;
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

export type PublicTask = Omit<BudgetTask, 'cost' | 'catalogConceptId'>;
export type PublicBudget = Omit<Budget, 'workItems' | 'catalogId' | 'sourceLeadId'> & {
  workItems: { id: string; name: string; tasks: PublicTask[] }[];
};
export interface SharedBudget {
  schemaVersion: 2;
  ownerUid: string;
  expiresAt: number;
  budget: PublicBudget;
  company: CompanyProfile;
  ivaRate: number;
  sharedAt: string;
}

export interface BudgetTemplate {
  ivaRate?: number;
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
  premiumExpiresAt?: string | null;
  premiumExpiresAtMillis?: number | null;
}

export interface UserData {
  uid: string;
  email: string;
  accountData: AccountData;
  totalBudgetsCreated: number;
  lastCreatedBudgetId?: string;
  createdAt: string;
}
