import type { CatalogPart } from '@/shared/types';
import { t } from '@/shared/i18n';

export function catalogSummary(parts: CatalogPart[]) {
  const concepts = parts.reduce((count, part) => count + part.concepts.length, 0);
  return `${t('catalog.conceptsCount', { count: concepts })} · ${t('catalog.partsCount', { count: parts.length })}`;
}
