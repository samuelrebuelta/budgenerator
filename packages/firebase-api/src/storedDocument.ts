import {
  decodeContent,
  type CONSTRUCTION_SCHEMA_VERSION,
  type ConstructionBusiness,
  type ConstructionContent,
  type ConstructionDocument,
  type ConstructionDocumentKind,
} from '@bg/domain/construction-document';
import type { DocumentReferenceLike, FirestoreSdk } from './firestorePort.js';

/**
 * Read side of the canonical document layout shared by budgets, templates and the catalog
 * (writes stay in the web's `construction-document/api/storage.ts` until phase 1):
 *
 *   <root>                  light root: id, kind, revision, chunkCount, business fields, workflow
 *   <root>/content/{0..7}   { index, revision, data } — the FIEBDC content as JSON, split by size
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
