import {
  CONSTRUCTION_SCHEMA_VERSION,
  contentOf,
  decodeContent,
  encodeContent,
  type ConstructionBusiness,
  type ConstructionContent,
  type ConstructionDocument,
  type ConstructionDocumentKind,
} from '@bg/domain/construction-document';
import type {
  DocumentReferenceLike,
  FirestoreLike,
  FirestoreSdk,
  TransactionLike,
} from './firestorePort.js';

/**
 * Firestore layout shared by budgets, templates and the catalog:
 *
 *   <root>                  light root: id, kind, revision, chunkCount, business fields, workflow
 *   <root>/content/{0..7}   { index, revision, data } — the FIEBDC content as JSON, split by size
 *
 * Every save runs in one transaction that checks the root revision (optimistic concurrency),
 * bumps it and rewrites the chunks with the new revision. Readers verify all chunks carry the
 * root revision, so a read that interleaves with a write retries instead of mixing versions.
 * Each function receives the platform SDK first (BG-014 D2).
 */
export interface StoredRoot {
  id: string;
  kind: ConstructionDocumentKind;
  schemaVersion: typeof CONSTRUCTION_SCHEMA_VERSION;
  revision: number;
  /** Revision of the content chunks; root-only updates (acceptance…) leave it unchanged. */
  contentRevision: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  clientName: string;
  address: string;
  date: string;
  budgetNumber: string;
  ivaRate: number;
  adjustment?: { multiplier: number; reason: string };
}

export interface StoredDocument<R extends StoredRoot = StoredRoot> {
  root: R;
  document: ConstructionDocument;
}

/** Root of `users/{uid}/budgets/{id}`. */
export interface BudgetRoot extends StoredRoot {
  number: number;
  acceptedAt?: string;
  projectId?: string;
  sourceLeadId?: string;
}

export function businessFromRoot(root: StoredRoot): ConstructionBusiness {
  return {
    name: root.name ?? '',
    clientName: root.clientName ?? '',
    address: root.address ?? '',
    date: root.date ?? '',
    budgetNumber: root.budgetNumber ?? '',
    ivaRate: typeof root.ivaRate === 'number' ? root.ivaRate : 0.1,
    ...(root.adjustment ? { adjustment: { ...root.adjustment } } : {}),
  };
}

export function assembleDocument(
  root: StoredRoot,
  content: ConstructionContent,
): ConstructionDocument {
  if (content.kind !== root.kind) throw new Error('El contenido no corresponde a su documento.');
  return { ...content, business: businessFromRoot(root) };
}

/** Reads the root and its chunks; retries when a concurrent save changed the revision. */
export async function readStoredDocument<R extends StoredRoot>(
  sdk: FirestoreSdk,
  root: DocumentReferenceLike,
  attempts = 3,
): Promise<StoredDocument<R> | null> {
  const { doc, getDoc } = sdk;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rootSnap = await getDoc(root);
    if (!rootSnap.exists()) return null;
    const data = rootSnap.data() as R;
    const chunks = await Promise.all(
      Array.from({ length: data.chunkCount }, (_, index) =>
        getDoc(doc(root, 'content', String(index))),
      ),
    );
    const consistent = chunks.every(
      (chunk) => chunk.exists() && chunk.data().revision === data.contentRevision,
    );
    if (!consistent) continue;
    const content = decodeContent(chunks.map((chunk) => chunk.data()!.data as string));
    return { root: data, document: assembleDocument(data, content) };
  }
  throw new Error('No se ha podido leer una versión coherente del documento. Inténtalo de nuevo.');
}

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

export function contentChunkRef(sdk: FirestoreSdk, root: DocumentReferenceLike, index: number) {
  return sdk.doc(root, 'content', String(index));
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
  sdk: FirestoreSdk,
  transaction: TransactionLike,
  root: DocumentReferenceLike,
  document: ConstructionDocument,
  revision: number,
  previousChunkCount: number,
): number {
  const chunks = encodeContent(contentOf(document));
  chunks.forEach((data, index) =>
    transaction.set(contentChunkRef(sdk, root, index), { index, revision, data }),
  );
  for (let index = chunks.length; index < previousChunkCount; index++)
    transaction.delete(contentChunkRef(sdk, root, index));
  return chunks.length;
}

/** Deletes the root and every chunk atomically. */
export async function deleteStoredDocument(
  sdk: FirestoreSdk,
  database: FirestoreLike,
  root: DocumentReferenceLike,
) {
  const snap = await sdk.getDoc(root);
  if (!snap.exists()) return;
  const chunkCount = (snap.data() as StoredRoot).chunkCount ?? 0;
  const batch = sdk.writeBatch(database);
  for (let index = 0; index < chunkCount; index++) batch.delete(contentChunkRef(sdk, root, index));
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
  sdk: FirestoreSdk,
  transaction: TransactionLike,
  root: DocumentReferenceLike,
  document: ConstructionDocument,
  rootData: Omit<StoredRoot, 'chunkCount' | 'contentRevision'> & Record<string, unknown>,
) {
  const chunkCount = writeContent(sdk, transaction, root, document, 1, 0);
  transaction.set(root, { ...rootData, revision: 1, contentRevision: 1, chunkCount });
  return chunkCount;
}

/**
 * Saves a new version only if the stored revision is still `expectedRevision`.
 * Returns the new revision. Throws RevisionConflictError when another client saved first.
 */
export async function saveStoredDocument(
  sdk: FirestoreSdk,
  database: FirestoreLike,
  root: DocumentReferenceLike,
  document: ConstructionDocument,
  expectedRevision: number,
  extra: Record<string, unknown> = {},
): Promise<number> {
  return sdk.runTransaction(database, async (transaction) => {
    const snap = await transaction.get(root);
    if (!snap.exists()) throw new StoredDocumentMissingError();
    const current = snap.data() as StoredRoot;
    if (current.revision !== expectedRevision) throw new RevisionConflictError();
    const revision = current.revision + 1;
    const chunkCount = writeContent(sdk, transaction, root, document, revision, current.chunkCount);
    transaction.update(root, {
      ...businessFields(document.business),
      adjustment: document.business.adjustment
        ? { ...document.business.adjustment }
        : sdk.deleteField(),
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
