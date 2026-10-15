import type { Tariff } from '@/shared/types';
import { t } from '@/shared/i18n';

export function catalogSummary(tariffs: Tariff[]) {
  const categories = new Set(tariffs.map((tariff) => tariff.category)).size;
  return `${t('catalog.conceptsCount', { count: tariffs.length })} · ${t('catalog.categoriesCount', { count: categories })}`;
}
