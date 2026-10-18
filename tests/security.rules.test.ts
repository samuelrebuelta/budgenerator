import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { budget, user } from './fixtures';
import { toPublicBudget } from '../src/entities/budget/model/publicBudget';
let env: RulesTestEnvironment;
const firestoreEmulator = new URL(
  `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'}`,
);
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cimbra-rules',
    firestore: {
      host: firestoreEmulator.hostname,
      port: Number(firestoreEmulator.port || 8180),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), user());
    await setDoc(doc(ctx.firestore(), 'users', 'bob'), user('bob'));
    await setDoc(doc(ctx.firestore(), 'users', 'admin'), {
      ...user('admin'),
      email: 'budgenerator@gmail.com',
      accountData: { isAdmin: true, plan: 'premium' },
    });
    await setDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'existing'), budget('existing'));
  });
});
const alice = () => env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
const bob = () => env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
const admin = () =>
  env.authenticatedContext('admin', { email: 'budgenerator@gmail.com' }).firestore();
async function createWithCount(
  db: ReturnType<typeof alice>,
  uid: string,
  id: string,
  count: number,
) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'budgets', id), budget(id));
  batch.update(doc(db, 'users', uid), { totalBudgetsCreated: count, lastCreatedBudgetId: id });
  return batch.commit();
}
describe('protected identity and account privileges', () => {
  it('allows normal registration but rejects self-provisioned admin or premium', async () => {
    const db = env.authenticatedContext('new', { email: 'new@example.test' }).firestore();
    await assertFails(
      setDoc(doc(db, 'users', 'new'), {
        ...user('new'),
        accountData: { isAdmin: true, plan: 'premium' },
      }),
    );
    await assertSucceeds(setDoc(doc(db, 'users', 'new'), user('new')));
  });
  it('denies role, plan, counter and recursive-wildcard privilege escalation', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', 'alice'), { 'accountData.isAdmin': true }));
    await assertFails(updateDoc(doc(alice(), 'users', 'alice'), { 'accountData.plan': 'premium' }));
    await assertFails(updateDoc(doc(alice(), 'users', 'alice'), { totalBudgetsCreated: -1 }));
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice', 'settings', 'userData'), {
        accountData: { isAdmin: true, plan: 'premium' },
      }),
    );
  });
  it('isolates owners and prevents ordinary users from enumerating accounts', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'users', 'alice')));
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'budgets', 'existing')));
    await assertFails(getDocs(collection(alice(), 'users')));
    await assertSucceeds(getDocs(collection(admin(), 'users')));
  });
  it('lets the designated admin manage plans but not assign client roles', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'users', 'alice'), {
        'accountData.plan': 'premium',
        'accountData.premiumExpiresAt': '2099-01-01T00:00:00.000Z',
        'accountData.premiumExpiresAtMillis': Date.parse('2099-01-01'),
      }),
    );
    await assertFails(updateDoc(doc(admin(), 'users', 'alice'), { 'accountData.isAdmin': true }));
  });
  it('does not trust a previously forged role belonging to another email', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'bob'), { 'accountData.isAdmin': true }),
    );
    await assertFails(getDocs(collection(bob(), 'users')));
  });
});
describe('atomic creation and quota', () => {
  it('requires a paired new budget and exact counter increment', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice', 'budgets', 'orphan'), budget('orphan')),
    );
    await assertFails(
      updateDoc(doc(alice(), 'users', 'alice'), {
        totalBudgetsCreated: 1,
        lastCreatedBudgetId: 'orphan',
      }),
    );
    await assertSucceeds(createWithCount(alice(), 'alice', 'new', 1));
    await assertFails(createWithCount(alice(), 'alice', 'other', 3));
  });
  it('blocks a fourth free creation, including after deletion', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'alice'), { totalBudgetsCreated: 3 }),
    );
    await assertSucceeds(deleteDoc(doc(alice(), 'users', 'alice', 'budgets', 'existing')));
    await assertFails(createWithCount(alice(), 'alice', 'fourth', 4));
  });
  it('does not let legacy conversion releases create new free quota', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'alice'), {
        totalBudgetsCreated: 3,
        budgetSlotsReleased: 2,
      }),
    );

    await assertFails(createWithCount(alice(), 'alice', 'fourth-after-legacy-release', 4));
  });
  it('uses server time for premium expiry', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'alice'), {
        totalBudgetsCreated: 3,
        accountData: {
          isAdmin: false,
          plan: 'premium',
          premiumExpiresAt: '2000-01-01',
          premiumExpiresAtMillis: 946684800000,
        },
      }),
    );
    await assertFails(createWithCount(alice(), 'alice', 'expired', 4));
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'alice'), {
        'accountData.premiumExpiresAt': '2099-01-01',
        'accountData.premiumExpiresAtMillis': 4070908800000,
      }),
    );
    await assertSucceeds(createWithCount(alice(), 'alice', 'active', 4));
  });
  it('allows updates without consuming quota and rejects document resurrection by update', async () => {
    await assertSucceeds(
      updateDoc(doc(alice(), 'users', 'alice', 'budgets', 'existing'), {
        'info.clientName': 'Changed',
      }),
    );
    await assertSucceeds(deleteDoc(doc(alice(), 'users', 'alice', 'budgets', 'existing')));
    await assertFails(
      updateDoc(doc(alice(), 'users', 'alice', 'budgets', 'existing'), {
        'info.clientName': 'Stale write',
      }),
    );
  });
});
describe('accepted budgets and projects', () => {
  it('does not allow an account to release budget quota without a linked project', async () => {
    await assertFails(
      updateDoc(doc(alice(), 'users', 'alice'), {
        budgetSlotsReleased: 1,
        lastConvertedBudgetId: 'existing',
      }),
    );
  });

  it('locks accepted budgets until acceptance is withdrawn', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      updateDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'existing'), {
        acceptedAt: '2026-10-18T09:00:00.000Z',
      }),
    );
    const ref = doc(alice(), 'users', 'alice', 'budgets', 'existing');

    await assertFails(updateDoc(ref, { 'info.clientName': 'Cambio no permitido' }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { acceptedAt: null }));
    await assertSucceeds(updateDoc(ref, { 'info.clientName': 'Oferta revisada' }));
  });

  it('allows the owner to read projects and denies another account access', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'alice', 'projects', 'project-1'), {
        id: 'project-1',
        sourceBudgetId: 'existing',
      });
      await setDoc(
        doc(ctx.firestore(), 'users', 'alice', 'projects', 'project-1', 'workItems', 'part-1'),
        { id: 'part-1', name: 'Pintura', tasks: [] },
      );
    });

    await assertSucceeds(getDocs(collection(alice(), 'users', 'alice', 'projects')));
    await assertSucceeds(
      getDoc(doc(alice(), 'users', 'alice', 'projects', 'project-1', 'workItems', 'part-1')),
    );
    await assertFails(
      setDoc(doc(alice(), 'users', 'alice', 'projects', 'project-1', 'workItems', 'extra'), {
        id: 'extra',
        name: 'No incluida en el snapshot',
        tasks: [],
      }),
    );
    await assertFails(getDoc(doc(bob(), 'users', 'alice', 'projects', 'project-1')));
    await assertFails(
      getDoc(doc(bob(), 'users', 'alice', 'projects', 'project-1', 'workItems', 'part-1')),
    );
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice', 'projects', 'project-1')));
  });

  it('allows conversion in the same atomic write without changing quota', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'alice'), { totalBudgetsCreated: 1 });
      await updateDoc(doc(ctx.firestore(), 'users', 'alice', 'budgets', 'existing'), {
        acceptedAt: '2026-10-18T09:00:00.000Z',
      });
    });
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'alice', 'projects', 'project-1'), {
      id: 'project-1',
      sourceBudgetId: 'existing',
      createdAt: '2026-10-18T10:00:00.000Z',
    });
    batch.set(doc(db, 'users', 'alice', 'projects', 'project-1', 'workItems', 'part-1'), {
      id: 'part-1',
      name: 'Pintura',
      tasks: [],
    });
    batch.update(doc(db, 'users', 'alice', 'budgets', 'existing'), { projectId: 'project-1' });

    await assertSucceeds(batch.commit());
    expect((await getDoc(doc(db, 'users', 'alice'))).data()).toMatchObject({
      totalBudgetsCreated: 1,
      budgetSlotsReleased: 0,
    });
  });
});
function snapshot(ownerUid = 'alice', expiresAt = Date.now() + 86400000) {
  return {
    schemaVersion: 2,
    ownerUid,
    expiresAt,
    budget: toPublicBudget(budget()),
    company: { name: 'Demo', cif: '', address: '', phone: '', email: '' },
    ivaRate: 0.1,
    sharedAt: new Date().toISOString(),
  };
}
describe('individual public snapshots', () => {
  it('allows individual anonymous reads but rejects collection enumeration', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'sharedBudgets', 'token'), snapshot()));
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'sharedBudgets', 'token')));
    await assertFails(getDocs(collection(db, 'sharedBudgets')));
  });
  it('denies unsafe legacy links and expired snapshots', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sharedBudgets', 'old'), { budget: budget() });
      await setDoc(
        doc(ctx.firestore(), 'sharedBudgets', 'expired'),
        snapshot('alice', Date.now() - 1000),
      );
    });
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'sharedBudgets', 'old')));
    await assertFails(getDoc(doc(db, 'sharedBudgets', 'expired')));
  });
  it('enforces ownership, bounded expiry and owner revocation', async () => {
    await assertFails(setDoc(doc(alice(), 'sharedBudgets', 'forged'), snapshot('bob')));
    await assertFails(
      setDoc(
        doc(alice(), 'sharedBudgets', 'forever'),
        snapshot('alice', Date.now() + 100 * 86400000),
      ),
    );
    await assertSucceeds(setDoc(doc(alice(), 'sharedBudgets', 'token'), snapshot()));
    await assertFails(deleteDoc(doc(bob(), 'sharedBudgets', 'token')));
    await assertSucceeds(deleteDoc(doc(alice(), 'sharedBudgets', 'token')));
  });
});
