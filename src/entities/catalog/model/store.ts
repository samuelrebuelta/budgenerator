import { useMemo } from 'react';
import '@/shared/platform';
import { createCatalogStore } from '@bg/app-core/stores/catalog';
import { bindStore } from '@/shared/lib/bindStore';
import * as catalogApi from '../api/firestore';
import { catalogView, type CatalogView } from './record';

export type {
  CatalogConceptInput,
  CatalogState,
  TradeImportResult,
  TradeImportScope,
} from '@bg/app-core/stores/catalog';

/** Web binding of the shared catalog store (`@bg/app-core`). */
const catalog = createCatalogStore({ repository: catalogApi });

export const useCatalogStore = bindStore(catalog.store);
export const resetCatalogStore = catalog.reset;
export const flushCatalogWrites = catalog.flushWrites;

export function setCatalogAuthGetter(_fn: () => string | null) {
  void _fn;
}

const emptyView: CatalogView = { id: '', name: '', parts: [], tariffs: [] };

/** Derived catalog view (chapters and items) for components. */
export function useCatalogView(): CatalogView {
  const record = useCatalogStore((state) => state.record);
  return useMemo(() => (record ? catalogView(record) : emptyView), [record]);
}

export function getCatalogContent() {
  return useCatalogStore.getState().record?.document ?? null;
}
