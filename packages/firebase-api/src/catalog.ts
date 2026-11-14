import type { ConstructionDocument } from '@bg/domain/construction-document';
import type { CatalogRecord } from '@bg/domain/catalog/record';
import {
  runGuarded,
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';
import {
  createInTransaction,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
} from './storedDocument.js';

/** The account has a single catalog document. */
export const CATALOG_DOCUMENT_ID = 'main';

export interface CatalogRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

/** Catalog of `users/{uid}/catalog/main` (BG-014 D2). */
export function createCatalogRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
}: CatalogRepositoryOptions) {
  const { doc, runTransaction } = sdk;

  function catalogRef(uid: string) {
    return doc(database, 'users', uid, 'catalog', CATALOG_DOCUMENT_ID);
  }

  async function fetchCatalog(uid: string): Promise<CatalogRecord | null> {
    const stored = await readStoredDocument(sdk, catalogRef(uid));
    if (!stored) return null;
    const { root, document } = stored;
    return {
      id: root.id,
      revision: root.revision,
      createdAt: root.createdAt,
      updatedAt: root.updatedAt,
      document,
    };
  }

  /** Creates the catalog from a seed only if it does not exist yet (idempotent across tabs). */
  async function ensureCatalog(uid: string, seed: ConstructionDocument): Promise<CatalogRecord> {
    const existing = await fetchCatalog(uid);
    if (existing) return existing;
    const now = new Date().toISOString();
    const created = await runGuarded(guardMutation, () =>
      runTransaction(database, async (transaction) => {
        const snap = await transaction.get(catalogRef(uid));
        if (snap.exists()) return false;
        createInTransaction(
          sdk,
          transaction,
          catalogRef(uid),
          seed,
          newRootFields(CATALOG_DOCUMENT_ID, seed, now),
        );
        return true;
      }),
    );
    if (created)
      return {
        id: CATALOG_DOCUMENT_ID,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        document: seed,
      };
    const record = await fetchCatalog(uid);
    if (!record) throw new Error('No se ha podido preparar el catálogo.');
    return record;
  }

  async function saveCatalog(uid: string, record: CatalogRecord, expectedRevision: number) {
    return runGuarded(guardMutation, () =>
      saveStoredDocument(sdk, database, catalogRef(uid), record.document, expectedRevision),
    );
  }

  return { catalogRef, fetchCatalog, ensureCatalog, saveCatalog };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
