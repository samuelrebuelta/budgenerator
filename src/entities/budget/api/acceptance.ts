import { deleteField, doc, runTransaction, type Firestore } from 'firebase/firestore';
import { assertBudget } from '@/shared/lib/budgetMath';
import { mapBudgetFromFirestore } from '../model/serialization';
import type { FirestoreBudget } from '../model/serialization';

export function createBudgetAcceptanceApi(database: Firestore) {
  async function acceptBudget(uid: string, budgetId: string, acceptedAt: string): Promise<void> {
    if (!acceptedAt.trim()) throw new Error('No se ha podido registrar la fecha de aceptación.');
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(budgetRef);
      if (!snapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
      const budget = mapBudgetFromFirestore(snapshot.data() as FirestoreBudget);
      if (budget.projectId) throw new Error('El presupuesto ya está cerrado como proyecto.');
      if (budget.acceptedAt) return;
      assertBudget(budget, true);
      transaction.update(budgetRef, { acceptedAt });
    });
  }

  async function withdrawBudgetAcceptance(uid: string, budgetId: string): Promise<void> {
    const budgetRef = doc(database, 'users', uid, 'budgets', budgetId);
    await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(budgetRef);
      if (!snapshot.exists()) throw new Error('No se ha encontrado el presupuesto.');
      const budget = mapBudgetFromFirestore(snapshot.data() as FirestoreBudget);
      if (budget.projectId) throw new Error('La aceptación ya está vinculada a un proyecto.');
      if (!budget.acceptedAt) return;
      transaction.update(budgetRef, { acceptedAt: deleteField() });
    });
  }

  return { acceptBudget, withdrawBudgetAcceptance };
}
