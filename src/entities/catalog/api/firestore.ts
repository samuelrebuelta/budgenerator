import { createCatalogRepository } from '@bg/firebase-api/catalog';
import { db } from '@/shared/firebase/config';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';

export { CATALOG_DOCUMENT_ID } from '@bg/firebase-api/catalog';

/** Web binding of the shared catalog repository (`@bg/firebase-api`, BG-014 D2). */
const repository = createCatalogRepository({
  sdk: webFirestoreSdk,
  database: db,
  guardMutation: guardNetworkMutation,
});

export const { catalogRef, fetchCatalog, ensureCatalog, saveCatalog } = repository;
