import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import { runNetworkMutation } from '@/shared/lib/networkMutation';
import {
  createInTransaction,
  deleteStoredDocument,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
  type StoredRoot,
} from '@/entities/construction-document/api/storage';
import type { ConstructionDocument } from '@/entities/construction-document/model';
import type { TemplateRecord } from '../model/record';

function templatesCol(uid: string) {
  return collection(db, 'users', uid, 'templates');
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

export async function fetchTemplates(uid: string): Promise<TemplateRecord[]> {
  const snap = await getDocs(templatesCol(uid));
  const records = await Promise.all(
    snap.docs.map(async (rootSnap) => {
      const stored = await readStoredDocument(rootSnap.ref);
      return stored ? toRecord(stored.root, stored.document) : null;
    }),
  );
  return records.filter((record): record is TemplateRecord => record !== null);
}

export async function createTemplate(
  uid: string,
  id: string,
  document: ConstructionDocument,
): Promise<TemplateRecord> {
  if (document.kind !== 'template') throw new Error('El documento no es una plantilla.');
  const ref = doc(templatesCol(uid), id);
  const now = new Date().toISOString();
  return runNetworkMutation(() =>
    runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        const root = existing.data() as StoredRoot;
        return toRecord(root, document);
      }
      createInTransaction(transaction, ref, document, newRootFields(id, document, now));
      return { id, revision: 1, createdAt: now, updatedAt: now, document };
    }),
  );
}

export async function saveTemplate(uid: string, record: TemplateRecord, expectedRevision: number) {
  return runNetworkMutation(() =>
    saveStoredDocument(db, doc(templatesCol(uid), record.id), record.document, expectedRevision),
  );
}

export async function deleteTemplateDoc(uid: string, templateId: string) {
  await runNetworkMutation(() => deleteStoredDocument(db, doc(templatesCol(uid), templateId)));
}
