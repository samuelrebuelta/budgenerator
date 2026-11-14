import { decodeContent, documentTotals } from '@bg/domain/construction-document';
import type { ConstructionDocument } from '@bg/domain/construction-document';
import type { BudgetRecord } from '@bg/domain/budget/record';
import { buildSharedBudget, type SharedBudget } from '@bg/domain/budget/publicBudget';
import { FREE_BUDGET_LIMIT, generateId, getBudgetSlotsUsed } from '@bg/domain/lib/utils';
import type { CompanyProfile, UserData } from '@bg/domain/types';
import {
  runGuarded,
  unguardedMutation,
  type DocumentReferenceLike,
  type FirestoreLike,
  type FirestoreSdk,
  type MutationGuard,
} from './firestorePort.js';
import {
  assembleDocument,
  contentChunkRef,
  createInTransaction,
  deleteStoredDocument,
  newRootFields,
  readStoredDocument,
  RevisionConflictError,
  saveStoredDocument,
  type BudgetRoot,
} from './storedDocument.js';

export type { SharedBudget };

export interface BudgetRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  /** Offline guard for mutations (web: `guardNetworkMutation`). */
  guardMutation?: MutationGuard;
  /** UID of the signed-in user, read when sharing (web: `auth.currentUser?.uid`). */
  currentUid: () => string | null | undefined;
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

/** Budgets of `users/{uid}/budgets` and their public share links (BG-014 D2). */
export function createBudgetRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
  currentUid,
}: BudgetRepositoryOptions) {
  const { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } = sdk;

  function budgetsCol(uid: string) {
    return collection(database, 'users', uid, 'budgets');
  }

  function budgetRef(uid: string, id: string): DocumentReferenceLike {
    return doc(budgetsCol(uid), id);
  }

  async function fetchBudget(uid: string, id: string): Promise<BudgetRecord | null> {
    const stored = await readStoredDocument<BudgetRoot>(sdk, budgetRef(uid, id));
    return stored ? recordFromStored(stored.root, stored.document) : null;
  }

  async function fetchBudgets(uid: string): Promise<BudgetRecord[]> {
    const snap = await getDocs(budgetsCol(uid));
    return Promise.all(
      snap.docs.map(async (rootSnap) => {
        const root = rootSnap.data() as BudgetRoot;
        const chunks = await Promise.all(
          Array.from({ length: root.chunkCount }, (_, index) =>
            getDoc(contentChunkRef(sdk, rootSnap.ref, index)),
          ),
        );
        if (
          chunks.every((chunk) => chunk.exists() && chunk.data().revision === root.contentRevision)
        )
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
  async function saveBudget(uid: string, record: BudgetRecord, expectedRevision: number) {
    return runGuarded(guardMutation, () =>
      saveStoredDocument(
        sdk,
        database,
        budgetRef(uid, record.id),
        record.document,
        expectedRevision,
      ),
    );
  }

  async function deleteBudgetDoc(uid: string, budgetId: string) {
    await runGuarded(guardMutation, () =>
      deleteStoredDocument(sdk, database, budgetRef(uid, budgetId)),
    );
  }

  /**
   * Creates the budget, consumes one quota slot and assigns the next sequential number from
   * the account counter in a single transaction. Retrying the same ID never charges twice.
   */
  async function createBudget(
    uid: string,
    record: BudgetRecord,
  ): Promise<{ userData: UserData; record: BudgetRecord }> {
    const totals = documentTotals(record.document);
    if (!totals.valid) throw new Error(totals.issues[0]?.message ?? 'Revisa el presupuesto.');
    return runGuarded(guardMutation, () =>
      runTransaction(database, async (transaction) => {
        const userRef = doc(database, 'users', uid);
        const rootRef = budgetRef(uid, record.id);
        const leadRef = record.sourceLeadId
          ? doc(database, 'users', uid, 'leads', record.sourceLeadId)
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
        createInTransaction(sdk, transaction, rootRef, document, {
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

  async function shareBudget(record: BudgetRecord, company: CompanyProfile): Promise<string> {
    const uid = currentUid();
    if (!uid) throw new Error('Inicia sesión para compartir.');
    const shared = buildSharedBudget(record, company, uid);
    // `crypto.randomUUID()` where the runtime has it (web); the registered generator elsewhere.
    const token = generateId();
    await runGuarded(guardMutation, () => setDoc(doc(database, 'sharedBudgets', token), shared));
    return token;
  }

  async function revokeSharedBudget(token: string) {
    await runGuarded(guardMutation, () => deleteDoc(doc(database, 'sharedBudgets', token)));
  }

  async function fetchSharedBudget(token: string): Promise<SharedBudget | null> {
    const snap = await getDoc(doc(database, 'sharedBudgets', token));
    if (!snap.exists()) return null;
    const shared = snap.data() as SharedBudget;
    if (shared.schemaVersion !== 3 || shared.expiresAt <= Date.now()) return null;
    return shared;
  }

  return {
    budgetRef,
    fetchBudget,
    fetchBudgets,
    saveBudget,
    deleteBudgetDoc,
    createBudget,
    shareBudget,
    revokeSharedBudget,
    fetchSharedBudget,
  };
}

export type BudgetRepository = ReturnType<typeof createBudgetRepository>;

export interface BudgetAcceptanceRepositoryOptions {
  sdk: FirestoreSdk;
  database: FirestoreLike;
  guardMutation?: MutationGuard;
}

/** Acceptance changes only workflow fields, but still bumps the revision for other devices. */
export function createBudgetAcceptanceRepository({
  sdk,
  database,
  guardMutation = unguardedMutation,
}: BudgetAcceptanceRepositoryOptions) {
  const { deleteField, doc, runTransaction } = sdk;

  async function acceptBudget(
    uid: string,
    budgetId: string,
    acceptedAt: string,
    expectedRevision: number,
  ): Promise<number> {
    if (!acceptedAt.trim()) throw new Error('No se ha podido registrar la fecha de aceptación.');
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    return runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(budgetRef);
      if (!snapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
      const budget = snapshot.data() as BudgetRoot;
      if (budget.projectId) throw new Error('El presupuesto ya está cerrado como proyecto.');
      if (budget.acceptedAt) return budget.revision;
      if (budget.revision !== expectedRevision) throw new RevisionConflictError();
      transaction.update(budgetRef, {
        acceptedAt,
        revision: budget.revision + 1,
        updatedAt: new Date().toISOString(),
      });
      return budget.revision + 1;
    });
  }

  async function withdrawBudgetAcceptance(uid: string, budgetId: string): Promise<number> {
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    return runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(budgetRef);
      if (!snapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
      const budget = snapshot.data() as BudgetRoot;
      if (budget.projectId) throw new Error('La aceptación ya está vinculada a un proyecto.');
      if (!budget.acceptedAt) return budget.revision;
      transaction.update(budgetRef, {
        acceptedAt: deleteField(),
        revision: budget.revision + 1,
        updatedAt: new Date().toISOString(),
      });
      return budget.revision + 1;
    });
  }

  return {
    acceptBudget: guardMutation(acceptBudget),
    withdrawBudgetAcceptance: guardMutation(withdrawBudgetAcceptance),
  };
}

export type BudgetAcceptanceRepository = ReturnType<typeof createBudgetAcceptanceRepository>;
