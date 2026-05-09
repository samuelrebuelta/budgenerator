import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const CONTACT_EMAIL = 'budgenerator@gmail.com';
export const MAX_LOGO_SIZE = 500 * 1024;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function generateId(): string {
  return crypto.randomUUID();
}
