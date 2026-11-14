import type { DocumentReference, Firestore, Transaction } from 'firebase/firestore';
import {
  contentChunkRef as sharedContentChunkRef,
  createInTransaction as sharedCreateInTransaction,
  deleteStoredDocument as sharedDeleteStoredDocument,
  readStoredDocument as sharedReadStoredDocument,
  saveStoredDocument as sharedSaveStoredDocument,
  writeContent as sharedWriteContent,
  type StoredDocument,
  type StoredRoot,
} from '@bg/firebase-api/storedDocument';
import { webFirestoreSdk } from '@/shared/firebase/firestoreSdk';
import type { ConstructionDocument } from '../model';

/**
 * Web binding of the canonical document storage shared by budgets, templates and the catalog.
 * The layout, the optimistic revision check and the errors live in `@bg/firebase-api`
 * (`storedDocument.ts`, BG-014 D2); these wrappers inject the Firebase JS SDK and keep the web
 * signatures (used by the Rules tests).
 */
export type { StoredDocument, StoredRoot } from '@bg/firebase-api/storedDocument';
export {
  assembleDocument,
  businessFields,
  businessFromRoot,
  newRootFields,
  RevisionConflictError,
  RevisionTracker,
  StoredDocumentMissingError,
} from '@bg/firebase-api/storedDocument';

export function contentChunkRef(root: DocumentReference, index: number) {
  return sharedContentChunkRef(webFirestoreSdk, root, index) as DocumentReference;
}

/** Writes all chunks for `revision` and deletes the ones a shorter version no longer uses. */
export function writeContent(
  transaction: Transaction,
  root: DocumentReference,
  document: ConstructionDocument,
  revision: number,
  previousChunkCount: number,
): number {
  return sharedWriteContent(
    webFirestoreSdk,
    transaction,
    root,
    document,
    revision,
    previousChunkCount,
  );
}

/** Reads the root and its chunks; retries when a concurrent save changed the revision. */
export function readStoredDocument<R extends StoredRoot>(
  root: DocumentReference,
  attempts = 3,
): Promise<StoredDocument<R> | null> {
  return sharedReadStoredDocument<R>(webFirestoreSdk, root, attempts);
}

/** Deletes the root and every chunk atomically. */
export function deleteStoredDocument(database: Firestore, root: DocumentReference) {
  return sharedDeleteStoredDocument(webFirestoreSdk, database, root);
}

/** Creates root + chunks inside an existing transaction (revision 1). */
export function createInTransaction(
  transaction: Transaction,
  root: DocumentReference,
  document: ConstructionDocument,
  rootData: Omit<StoredRoot, 'chunkCount' | 'contentRevision'> & Record<string, unknown>,
) {
  return sharedCreateInTransaction(webFirestoreSdk, transaction, root, document, rootData);
}

/**
 * Saves a new version only if the stored revision is still `expectedRevision`.
 * Returns the new revision. Throws RevisionConflictError when another client saved first.
 */
export function saveStoredDocument(
  database: Firestore,
  root: DocumentReference,
  document: ConstructionDocument,
  expectedRevision: number,
  extra: Record<string, unknown> = {},
): Promise<number> {
  return sharedSaveStoredDocument(
    webFirestoreSdk,
    database,
    root,
    document,
    expectedRevision,
    extra,
  );
}
