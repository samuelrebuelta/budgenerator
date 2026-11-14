import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export * from '@bg/domain/lib/utils';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
