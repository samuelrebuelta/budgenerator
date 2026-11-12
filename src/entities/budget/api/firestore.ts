import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
  type DocumentReference,
} from 'firebase/firestore';
import { db, auth } from '@/shared/firebase/config';
import { runNetworkMutation } from '@/shared/lib/networkMutation';
import { FREE_BUDGET_LIMIT, getBudgetSlotsUsed } from '@/shared/lib/utils';
import {
  decodeContent,
  documentTotals,
  type ConstructionDocument,
} from '@/entities/construction-document/model';
import {
  assembleDocument,
  contentChunkRef,
  createInTransaction,
  deleteStoredDocument,
  newRootFields,
  readStoredDocument,
  saveStoredDocument,
  type StoredRoot,
} from '@/entities/construction-document/api/storage';
import type { BudgetRecord } from '../model/record';
import { buildSharedBudget, type SharedBudget } from '../model/publicBudget';

export type { SharedBudget };
import type { CompanyProfile, UserData } from '@/shared/types';

export interface BudgetRoot extends StoredRoot {
  number: number;
  acceptedAt?: string;
  projectId?: string;
  sourceLeadId?: string;
}

function budgetsCol(uid: string) {
  return collection(db, 'users', uid, 'budgets');
}

export function budgetRef(uid: string, id: string): DocumentReference {
  return doc(budgetsCol(uid), id);
}

export function recordFromStored(root: BudgetRoot, document: ConstructionDocument): BudgetRecord {
  return {
    id: root.id,
    revision: root.revision,
    number: root.number,
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
    ...(root.acceptedAt ? { acceptedAt: root.acceptedAt } : {}),
    ...(root.projectId ? { projectId: root.projectId } : {}),
    ...(root.sourceLeadId ? { sourceLeadId: root.sourceLeadId } : {}),
    document,
  };
}

export async function fetchBudget(uid: string, id: string): Promise<BudgetRecord | null> {
  const stored = await readStoredDocument<BudgetRoot>(budgetRef(uid, id));
  return stored ? recordFromStored(stored.root, stored.document) : null;
}

export async function fetchBudgets(uid: string): Promise<BudgetRecord[]> {
  const snap = await getDocs(budgetsCol(uid));
  return Promise.all(
    snap.docs.map(async (rootSnap) => {
      const root = rootSnap.data() as BudgetRoot;
      const chunks = await Promise.all(
        Array.from({ length: root.chunkCount }, (_, index) =>
          getDoc(contentChunkRef(rootSnap.ref, index)),
        ),
      );
      if (chunks.every((chunk) => chunk.exists() && chunk.data().revision === root.contentRevision))
        return recordFromStored(
          root,
          assembleDocument(
            root,
            decodeContent(chunks.map((chunk) => chunk.data()!.data as string)),
          ),
        );
      const fresh = await fetchBudget(uid, root.id);
      if (!fresh) throw new Error('Un presupuesto se ha borrado mientras se cargaba.');
      return fresh;
    }),
  );
}

/** Saves a new version of an editable budget. Returns the new server revision. */
export async function saveBudget(uid: string, record: BudgetRecord, expectedRevision: number) {
  return runNetworkMutation(() =>
    saveStoredDocument(db, budgetRef(uid, record.id), record.document, expectedRevision),
  );
}

export async function deleteBudgetDoc(uid: string, budgetId: string) {
  await runNetworkMutation(() => deleteStoredDocument(db, budgetRef(uid, budgetId)));
}

/**
 * Creates the budget, consumes one quota slot and assigns the next sequential number from
 * the account counter in a single transaction. Retrying the same ID never charges twice.
 */
export async function createBudget(
  uid: string,
  record: BudgetRecord,
): Promise<{ userData: UserData; record: BudgetRecord }> {
  const totals = documentTotals(record.document);
  if (!totals.valid) throw new Error(totals.issues[0]?.message ?? 'Revisa el presupuesto.');
  return runNetworkMutation(() =>
    runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', uid);
      const rootRef = budgetRef(uid, record.id);
      const leadRef = record.sourceLeadId
        ? doc(db, 'users', uid, 'leads', record.sourceLeadId)
        : null;
      const [userSnap, existing, leadSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(rootRef),
        leadRef ? transaction.get(leadRef) : Promise.resolve(null),
      ]);
      if (!userSnap.exists()) throw new Error('No se ha podido cargar tu cuenta.');
      const user = userSnap.data() as UserData;
      if (existing.exists()) {
        const root = existing.data() as BudgetRoot;
        return {
          userData: user,
          record: { ...record, revision: root.revision, number: root.number },
        };
      }
      if (leadRef && !leadSnap?.exists())
        throw new Error('No se ha encontrado la solicitud de origen.');
      const account = user.accountData;
      const premium =
        account.plan === 'premium' &&
        (!account.premiumExpiresAt || Date.parse(account.premiumExpiresAt) > Date.now());
      if (!premium && getBudgetSlotsUsed(user.totalBudgetsCreated) >= FREE_BUDGET_LIMIT)
        throw new Error('Has alcanzado el límite de tu plan.');
      const number = user.totalBudgetsCreated + 1;
      const now = new Date().toISOString();
      const document: ConstructionDocument = {
        ...record.document,
        business: {
          ...record.document.business,
          budgetNumber: record.document.business.budgetNumber.trim() || String(number),
        },
      };
      createInTransaction(transaction, rootRef, document, {
        ...newRootFields(record.id, document, now),
        number,
        ...(record.sourceLeadId ? { sourceLeadId: record.sourceLeadId } : {}),
      });
      transaction.update(userRef, {
        totalBudgetsCreated: number,
        lastCreatedBudgetId: record.id,
      });
      if (leadRef) transaction.update(leadRef, { budgetId: record.id });
      return {
        userData: { ...user, totalBudgetsCreated: number, lastCreatedBudgetId: record.id },
        record: { ...record, document, revision: 1, number, createdAt: now, updatedAt: now },
      };
    }),
  );
}

export async function shareBudget(record: BudgetRecord, company: CompanyProfile): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Inicia sesión para compartir.');
  const shared = buildSharedBudget(record, company, uid);
  const token = crypto.randomUUID();
  await runNetworkMutation(() => setDoc(doc(db, 'sharedBudgets', token), shared));
  return token;
}

export async function revokeSharedBudget(token: string) {
  await runNetworkMutation(() => deleteDoc(doc(db, 'sharedBudgets', token)));
}

export async function fetchSharedBudget(token: string): Promise<SharedBudget | null> {
  const snap = await getDoc(doc(db, 'sharedBudgets', token));
  if (!snap.exists()) return null;
  const shared = snap.data() as SharedBudget;
  if (shared.schemaVersion !== 3 || shared.expiresAt <= Date.now()) return null;
  return shared;
}
