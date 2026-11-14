import type { ConstructionDocument } from '@bg/domain/construction-document';
import {
  runGuarded,
  unguardedMutation,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';
import {
  createInTransaction,
  deleteStoredDocument,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
  type StoredRoot,
} from './storedDocument.js';

/** Stored template; the web adds its derived view on top (`entities/template/model/record`). */
export interface TemplateRecord {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  document: ConstructionDocument;
}

export interface TemplateRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

function toRecord(root: StoredRoot, document: ConstructionDocument): TemplateRecord {
  return {
    id: root.id,
    revision: root.revision,
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
    document,
  };
}

/** Templates of `users/{uid}/templates` (BG-014 D2). */
export function createTemplateRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
}: TemplateRepositoryOptions) {
  const { collection, doc, getDocs, runTransaction } = sdk;

  function templatesCol(uid: string) {
    return collection(database, 'users', uid, 'templates');
  }

  async function fetchTemplates(uid: string): Promise<TemplateRecord[]> {
    const snap = await getDocs(templatesCol(uid));
    const records = await Promise.all(
      snap.docs.map(async (rootSnap) => {
        const stored = await readStoredDocument(sdk, rootSnap.ref);
        return stored ? toRecord(stored.root, stored.document) : null;
      }),
    );
    return records.filter((record): record is TemplateRecord => record !== null);
  }

  async function createTemplate(
    uid: string,
    id: string,
    document: ConstructionDocument,
  ): Promise<TemplateRecord> {
    if (document.kind !== 'template') throw new Error('El documento no es una plantilla.');
    const ref = doc(templatesCol(uid), id);
    const now = new Date().toISOString();
    return runGuarded(guardMutation, () =>
      runTransaction(database, async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists()) {
          const root = existing.data() as StoredRoot;
          return toRecord(root, document);
        }
        createInTransaction(sdk, transaction, ref, document, newRootFields(id, document, now));
        return { id, revision: 1, createdAt: now, updatedAt: now, document };
      }),
    );
  }

  async function saveTemplate(uid: string, record: TemplateRecord, expectedRevision: number) {
    return runGuarded(guardMutation, () =>
      saveStoredDocument(
        sdk,
        database,
        doc(templatesCol(uid), record.id),
        record.document,
        expectedRevision,
      ),
    );
  }

  async function deleteTemplateDoc(uid: string, templateId: string) {
    await runGuarded(guardMutation, () =>
      deleteStoredDocument(sdk, database, doc(templatesCol(uid), templateId)),
    );
  }

  return { fetchTemplates, createTemplate, saveTemplate, deleteTemplateDoc };
}

export type TemplateRepository = ReturnType<typeof createTemplateRepository>;
