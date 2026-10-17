export {
  DEFAULT_TARIFFS,
  RENOVATION_CATEGORIES,
  getTariffById,
  getTariffsByCategory,
  getCategories,
} from './model/catalog';
export { useCatalogStore, setCatalogAuthGetter } from './model/store';
export { BASE_CATALOGS } from './model/baseCatalogs';
export { TRADE_CATALOGS } from './model/baseCatalogs';
export type { BaseCatalog } from './model/baseCatalogs';
export type { TradeImportScope, TradeImportResult } from './model/tradeImport';
export type { TariffCatalog } from '@/shared/types';

export {
  searchCatalogParts,
  searchTariffs,
  normalizeCatalogText,
  compareSpanish,
} from './model/search';
