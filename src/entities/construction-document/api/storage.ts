import {
  deleteField,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import {
  readStoredDocument as readSharedStoredDocument,
  type StoredDocument,
  type StoredRoot,
} from '@bg/firebase-api/storedDocument';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import {
  CONSTRUCTION_SCHEMA_VERSION,
  contentOf,
  encodeContent,
  type ConstructionBusiness,
  type ConstructionDocument,
} from '../model';

/**
 * Firestore layout shared by budgets, templates and the catalog:
 *
 *   <root>                  light root: id, kind, revision, chunkCount, business fields, workflow
 *   <root>/content/{0..7}   { index, revision, data } — the FIEBDC content as JSON, split by size
 *
 * Every save runs in one transaction that checks the root revision (optimistic concurrency),
 * bumps it and rewrites the chunks with the new revision. Readers verify all chunks carry the
 * root revision, so a read that interleaves with a write retries instead of mixing versions.
 * The read side and the root types live in `@bg/firebase-api` (shared with mobile, BG-014 D2).
 */
export type { StoredDocument, StoredRoot } from '@bg/firebase-api/storedDocument';
export { assembleDocument, businessFromRoot } from '@bg/firebase-api/storedDocument';

export class RevisionConflictError extends Error {
  constructor() {
    super('Este documento se ha modificado desde otro dispositivo o pestaña.');
    this.name = 'RevisionConflictError';
  }
}

export class StoredDocumentMissingError extends Error {
  constructor() {
    super('El documento ya no existe.');
    this.name = 'StoredDocumentMissingError';
  }
}

export function contentChunkRef(root: DocumentReference, index: number) {
  return doc(root, 'content', String(index));
}

export function businessFields(business: ConstructionBusiness) {
  return {
    name: business.name.slice(0, 200),
    clientName: business.clientName,
    address: business.address,
    date: business.date,
    budgetNumber: business.budgetNumber,
    ivaRate: business.ivaRate,
    ...(business.adjustment
      ? {
          adjustment: {
            multiplier: business.adjustment.multiplier,
            reason: business.adjustment.reason,
          },
        }
      : {}),
  };
}

/** Writes all chunks for `revision` and deletes the ones a shorter version no longer uses. */
export function writeContent(
  transaction: Transaction,
  root: DocumentReference,
  document: ConstructionDocument,
  revision: number,
  previousChunkCount: number,
): number {
  const chunks = encodeContent(contentOf(document));
  chunks.forEach((data, index) =>
    transaction.set(contentChunkRef(root, index), { index, revision, data }),
  );
  for (let index = chunks.length; index < previousChunkCount; index++)
    transaction.delete(contentChunkRef(root, index));
  return chunks.length;
}

/** Reads the root and its chunks; retries when a concurrent save changed the revision. */
export function readStoredDocument<R extends StoredRoot>(
  root: DocumentReference,
  attempts = 3,
): Promise<StoredDocument<R> | null> {
  return readSharedStoredDocument<R>(webFirestoreSdk, root, attempts);
}

/** Deletes the root and every chunk atomically. */
export async function deleteStoredDocument(database: Firestore, root: DocumentReference) {
  const snap = await getDoc(root);
  if (!snap.exists()) return;
  const chunkCount = (snap.data() as StoredRoot).chunkCount ?? 0;
  const batch = writeBatch(database);
  for (let index = 0; index < chunkCount; index++) batch.delete(contentChunkRef(root, index));
  batch.delete(root);
  await batch.commit();
}

/** Root fields shared by every stored kind on creation. */
export function newRootFields(
  id: string,
  document: ConstructionDocument,
  now: string,
): Omit<StoredRoot, 'chunkCount' | 'contentRevision'> {
  return {
    id,
    kind: document.kind,
    schemaVersion: CONSTRUCTION_SCHEMA_VERSION,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...businessFields(document.business),
  };
}

/** Creates root + chunks inside an existing transaction (revision 1). */
export function createInTransaction(
  transaction: Transaction,
  root: DocumentReference,
  document: ConstructionDocument,
  rootData: Omit<StoredRoot, 'chunkCount' | 'contentRevision'> & Record<string, unknown>,
) {
  const chunkCount = writeContent(transaction, root, document, 1, 0);
  transaction.set(root, { ...rootData, revision: 1, contentRevision: 1, chunkCount });
  return chunkCount;
}

/**
 * Saves a new version only if the stored revision is still `expectedRevision`.
 * Returns the new revision. Throws RevisionConflictError when another client saved first.
 */
export async function saveStoredDocument(
  database: Firestore,
  root: DocumentReference,
  document: ConstructionDocument,
  expectedRevision: number,
  extra: Record<string, unknown> = {},
): Promise<number> {
  return runTransaction(database, async (transaction) => {
    const snap = await transaction.get(root);
    if (!snap.exists()) throw new StoredDocumentMissingError();
    const current = snap.data() as StoredRoot;
    if (current.revision !== expectedRevision) throw new RevisionConflictError();
    const revision = current.revision + 1;
    const chunkCount = writeContent(transaction, root, document, revision, current.chunkCount);
    transaction.update(root, {
      ...businessFields(document.business),
      adjustment: document.business.adjustment
        ? { ...document.business.adjustment }
        : deleteField(),
      revision,
      contentRevision: revision,
      chunkCount,
      updatedAt: new Date().toISOString(),
      ...extra,
    });
    return revision;
  });
}

/** Tracks the last revision this client confirmed for each stored document. */
export class RevisionTracker {
  private revisions = new Map<string, number>();
  get(key: string) {
    return this.revisions.get(key);
  }
  set(key: string, revision: number) {
    this.revisions.set(key, revision);
  }
  delete(key: string) {
    this.revisions.delete(key);
  }
  clear() {
    this.revisions.clear();
  }
}
