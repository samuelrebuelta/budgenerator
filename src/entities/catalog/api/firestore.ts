import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import { runNetworkMutation } from '@/shared/lib/networkMutation';
import {
  createInTransaction,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
} from '@/entities/construction-document/api/storage';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import type { CatalogRecord } from '../model/record';

/** The account has a single catalog document. */
export const CATALOG_DOCUMENT_ID = 'main';

export function catalogRef(uid: string) {
  return doc(db, 'users', uid, 'catalog', CATALOG_DOCUMENT_ID);
}

export async function fetchCatalog(uid: string): Promise<CatalogRecord | null> {
  const stored = await readStoredDocument(catalogRef(uid));
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
export async function ensureCatalog(
  uid: string,
  seed: ConstructionDocument,
): Promise<CatalogRecord> {
  const existing = await fetchCatalog(uid);
  if (existing) return existing;
  const now = new Date().toISOString();
  const created = await runNetworkMutation(() =>
    runTransaction(db, async (transaction) => {
      const snap = await transaction.get(catalogRef(uid));
      if (snap.exists()) return false;
      createInTransaction(
        transaction,
        catalogRef(uid),
        seed,
        newRootFields(CATALOG_DOCUMENT_ID, seed, now),
      );
      return true;
    }),
  );
  if (created)
    return { id: CATALOG_DOCUMENT_ID, revision: 1, createdAt: now, updatedAt: now, document: seed };
  const record = await fetchCatalog(uid);
  if (!record) throw new Error('No se ha podido preparar el catálogo.');
  return record;
}

export async function saveCatalog(uid: string, record: CatalogRecord, expectedRevision: number) {
  return runNetworkMutation(() =>
    saveStoredDocument(db, catalogRef(uid), record.document, expectedRevision),
  );
}
