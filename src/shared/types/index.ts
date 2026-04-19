export type Unit = 'm2' | 'm3' | 'ml' | 'unit' | 'hour';

export const UNIT_LABELS: Record<Unit, string> = {
  m2: 'M²',
  m3: 'M³',
  ml: 'ML',
  unit: 'Ud.',
  hour: 'Hr',
};

export interface BudgetRow {
  id: string;
  description: string;
  quantity: number;
  unit: Unit;
  price: number;
  cost: number;
}

export interface Section {
  id: string;
  name: string;
  rows: BudgetRow[];
}

export interface BudgetInfo {
  clientName: string;
  address: string;
  date: string;
  budgetNumber: string;
}

export interface Budget {
  id: string;
  info: BudgetInfo;
  sections: Section[];
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
