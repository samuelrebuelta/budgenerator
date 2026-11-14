import { describe, expect, it, vi } from 'vitest';
import type { AuthUserLike } from '../src/authPort';
import { createAuthRepository } from '../src/auth';
import { createBudgetAcceptanceRepository, createBudgetRepository } from '../src/budget';
import { createCatalogRepository } from '../src/catalog';
import type { MutationGuard } from '../src/firestorePort';
import type { FunctionsPort } from '../src/functionsPort';
import { createNotificationsRepository } from '../src/notifications';
import { createProfileRepository } from '../src/profile';
import { createTemplateRepository } from '../src/template';
import { createUserRepository } from '../src/user';
import { RevisionConflictError } from '../src/storedDocument';
import { budgetRecord, sampleDocument, user } from '../../domain/tests/fixtures';
import { memoryFirestore } from './memoryFirestore';

/** Guard that records what it wrapped, like the web's `guardNetworkMutation`. */
function recordingGuard() {
  const calls: string[] = [];
  const guard: MutationGuard =
    (operation) =>
    async (...args) => {
      calls.push('guarded');
      return operation(...args);
    };
  return { guard, calls };
}

describe('repositorios con el SDK inyectado', () => {
  it('crea, guarda con revisión optimista y borra un presupuesto con sus fragmentos', async () => {
    const store = memoryFirestore();
    store.data.set('users/alice', user('alice'));
    const { guard, calls } = recordingGuard();
    const budgets = createBudgetRepository({
      ...store,
      guardMutation: guard,
      currentUid: () => 'alice',
    });

    const created = await budgets.createBudget('alice', budgetRecord('b1'));
    expect(created.record).toMatchObject({ id: 'b1', revision: 1, number: 1 });
    expect(created.userData.totalBudgetsCreated).toBe(1);
    expect(store.data.get('users/alice/budgets/b1')).toMatchObject({ revision: 1, number: 1 });

    const [loaded] = await budgets.fetchBudgets('alice');
    expect(loaded?.document.business.clientName).toBe(created.record.document.business.clientName);

    await expect(budgets.saveBudget('alice', created.record, 1)).resolves.toBe(2);
    await expect(budgets.saveBudget('alice', created.record, 1)).rejects.toBeInstanceOf(
      RevisionConflictError,
    );

    await budgets.deleteBudgetDoc('alice', 'b1');
    expect([...store.data.keys()].filter((key) => key.includes('budgets/b1'))).toEqual([]);
    expect(calls).toEqual(['guarded', 'guarded', 'guarded', 'guarded']);
  });

  it('valida el presupuesto antes de pasar por la guarda de red', async () => {
    const store = memoryFirestore();
    const { guard, calls } = recordingGuard();
    const budgets = createBudgetRepository({
      ...store,
      guardMutation: guard,
      currentUid: () => null,
    });
    const invalid = budgetRecord('b1');
    // A tree that references no concept cannot be priced.
    invalid.document = { ...invalid.document, concepts: {} };

    await expect(budgets.createBudget('alice', invalid)).rejects.toThrow();
    await expect(budgets.shareBudget(budgetRecord('b1'), {} as never)).rejects.toThrow(
      'Inicia sesión',
    );
    expect(calls).toEqual([]);
  });

  it('acepta y retira la aceptación subiendo la revisión', async () => {
    const store = memoryFirestore();
    store.data.set('users/alice', user('alice'));
    const budgets = createBudgetRepository({ ...store, currentUid: () => 'alice' });
    await budgets.createBudget('alice', budgetRecord('b1'));
    const acceptance = createBudgetAcceptanceRepository(store);

    await expect(acceptance.acceptBudget('alice', 'b1', '2026-11-14', 0)).rejects.toBeInstanceOf(
      RevisionConflictError,
    );
    await expect(acceptance.acceptBudget('alice', 'b1', '2026-11-14', 1)).resolves.toBe(2);
    await expect(acceptance.withdrawBudgetAcceptance('alice', 'b1')).resolves.toBe(3);
    expect(store.data.get('users/alice/budgets/b1')).not.toHaveProperty('acceptedAt');
  });

  it('crea el catálogo una sola vez y las plantillas son idempotentes por ID', async () => {
    const store = memoryFirestore();
    const catalog = createCatalogRepository(store);
    const seed = sampleDocument('catalog');
    const first = await catalog.ensureCatalog('alice', seed);
    const second = await catalog.ensureCatalog('alice', sampleDocument('catalog'));
    expect(first.revision).toBe(1);
    expect(second.createdAt).toBe(first.createdAt);

    const templates = createTemplateRepository(store);
    const template = sampleDocument('template');
    await templates.createTemplate('alice', 't1', template);
    await templates.createTemplate('alice', 't1', template);
    await expect(templates.fetchTemplates('alice')).resolves.toHaveLength(1);
    await expect(templates.createTemplate('alice', 't2', seed)).rejects.toThrow('plantilla');
  });

  it('migra el perfil antiguo y guarda la aceptación legal con la hora del servidor', async () => {
    const store = memoryFirestore();
    store.data.set('users/alice/settings/profile', { name: 'Antigua' });
    const profiles = createProfileRepository(store);
    await expect(profiles.fetchProfile('alice')).resolves.toEqual({ name: 'Antigua' });
    expect(store.data.has('users/alice/settings/profile')).toBe(false);
    expect(store.data.get('users/alice/profile/data')).toEqual({ name: 'Antigua' });

    const users = createUserRepository(store);
    await users.saveUserData('alice', user('alice'), 'v1');
    expect(store.data.get('users/alice')).toMatchObject({
      legalAcceptance: { version: 'v1', acceptedAt: '2026-11-14T00:00:00.000Z' },
    });
  });
});

describe('callables y auth con puertos', () => {
  function functionsPort() {
    const calls: { name: string; data: unknown; timeout?: number }[] = [];
    const port: FunctionsPort = {
      httpsCallable: (name, options) => async (data) => {
        calls.push({ name, data, timeout: options?.timeout });
        return { data: { name } as never };
      },
    };
    return { port, calls };
  }

  it('llama a las callables de avisos por su nombre y guarda las mutaciones', async () => {
    const { port, calls } = functionsPort();
    const { guard, calls: guarded } = recordingGuard();
    const notifications = createNotificationsRepository({ functions: port, guardMutation: guard });
    await notifications.registerPushDevice({
      installationId: 'i',
      registrationToken: 't',
      platform: 'ios',
    });
    await notifications.revokePushDevice('i');
    expect(calls.map(({ name }) => name)).toEqual(['registerPushDevice', 'revokePushDevice']);
    expect(guarded).toEqual(['guarded']);
  });

  it('reautentica antes de borrar la cuenta y cierra la sesión', async () => {
    const steps: string[] = [];
    const currentUser = {
      uid: 'alice',
      email: 'alice@example.test',
      emailVerified: true,
      reload: async () => void steps.push('reload'),
      getIdToken: async (force?: boolean) => (steps.push(`token:${force}`), 't'),
      getIdTokenResult: async () => ({ claims: { admin: true } }),
    };
    const auth = { currentUser };
    const { port, calls } = functionsPort();
    const repository = createAuthRepository<AuthUserLike>({
      auth,
      functions: port,
      sdk: {
        signInWithEmailAndPassword: vi.fn(),
        createUserWithEmailAndPassword: vi.fn(),
        signOut: async () => void steps.push('signOut'),
        onAuthStateChanged: vi.fn(),
        sendPasswordResetEmail: vi.fn(),
        sendEmailVerification: vi.fn(),
        reauthenticateWithCredential: async (_user, credential) =>
          void steps.push(`reauth:${JSON.stringify(credential)}`),
        updatePassword: vi.fn(),
        emailCredential: (email, password) => ({ email, password }),
      },
    });

    await repository.deleteAccount('secret');
    expect(steps).toEqual([
      'reauth:{"email":"alice@example.test","password":"secret"}',
      'token:true',
      'signOut',
    ]);
    expect(calls).toEqual([{ name: 'deleteAccount', data: undefined, timeout: 300_000 }]);
    await expect(repository.readAdminClaim(currentUser)).resolves.toBe(true);
  });

  it('lee la verificación del usuario recargado aunque el SDK lo sustituya (RNFB)', async () => {
    const steps: string[] = [];
    const user = (emailVerified: boolean): AuthUserLike => ({
      uid: 'alice',
      email: 'alice@example.test',
      emailVerified,
      reload: async () => {
        // Like React Native Firebase: the stale snapshot keeps its value.
        auth.currentUser = user(true);
      },
      getIdToken: async (force?: boolean) => (steps.push(`token:${force}`), 't'),
      getIdTokenResult: async () => ({ claims: {} }),
    });
    const auth: { currentUser: AuthUserLike | null } = { currentUser: user(false) };
    const repository = createAuthRepository<AuthUserLike>({
      auth,
      functions: functionsPort().port,
      sdk: {} as never,
    });

    await expect(repository.refreshEmailVerification()).resolves.toBe(true);
    expect(steps).toEqual(['token:true']);
  });
});
