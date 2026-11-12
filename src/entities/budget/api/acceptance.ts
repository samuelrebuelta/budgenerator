import { deleteField, doc, runTransaction, type Firestore } from 'firebase/firestore';
import { guardNetworkMutation } from '@/shared/lib/networkMutation';
import { RevisionConflictError } from '@/entities/construction-document/api/storage';
import type { BudgetRoot } from './firestore';

/** Acceptance changes only workflow fields, but still bumps the revision for other devices. */
export function createBudgetAcceptanceApi(database: Firestore) {
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
    acceptBudget: guardNetworkMutation(acceptBudget),
    withdrawBudgetAcceptance: guardNetworkMutation(withdrawBudgetAcceptance),
  };
}
