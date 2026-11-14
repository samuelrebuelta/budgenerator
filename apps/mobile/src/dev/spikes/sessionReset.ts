import { getAuth, signOut } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  getFirestore,
} from '@react-native-firebase/firestore';
import { existsMMKV } from 'react-native-mmkv';
import { resetSession } from '../../platform/sessionReset';
import { userStorage, userStorageId } from '../../platform/userStorage';
import { SpikeRecorder, type SpikeResult } from './report';
import { createSyntheticUser, seedAcceptedBudget } from './projectRepository';

async function cachedBudgets(uid: string): Promise<number> {
  try {
    const snapshot = await getDocsFromCache(collection(getFirestore(), 'users', uid, 'budgets'));
    return snapshot.docs.length;
  } catch {
    return 0;
  }
}

async function cachedRoot(uid: string, budgetId: string): Promise<string> {
  try {
    const snapshot = await getDocFromCache(doc(getFirestore(), 'users', uid, 'budgets', budgetId));
    return snapshot.exists() ? `en caché (${String(snapshot.data()?.clientName)})` : 'no existe';
  } catch (error) {
    return `sin caché (${error instanceof Error ? error.message.slice(0, 60) : 'error'})`;
  }
}

/** User A reads a budget (server → disk cache) and leaves a value in its MMKV. */
async function signInAndRead(recorder: SpikeRecorder, label: string) {
  const user = await recorder.step(
    `${label}: crear e iniciar sesión`,
    () => createSyntheticUser(`d3-${label.toLowerCase()}`),
    (value) => value.uid,
  );
  const budgetId = 'budget-a';
  await seedAcceptedBudget(user.uid, budgetId);
  await recorder.step(
    `${label}: leer presupuestos del servidor`,
    () => getDocs(collection(getFirestore(), 'users', user.uid, 'budgets')),
    (snapshot) => `${snapshot.docs.length} doc(s), fromCache=${snapshot.metadata.fromCache}`,
  );
  userStorage(user.uid).set('lastTab', 'projects');
  return { ...user, budgetId };
}

/**
 * Spike D3. Control: with a plain sign-out, the next account can still read the previous
 * account's documents from the native disk cache (cache reads skip the rules). Then the same
 * sequence with `resetSession` (terminate + clearPersistence + MMKV of the UID + sign-out).
 */
export async function runSessionResetSpike(): Promise<SpikeResult> {
  const recorder = new SpikeRecorder('d3-session-reset');
  try {
    // Start from a clean cache so the control is not polluted by earlier runs.
    await recorder.step('limpieza inicial (resetSession sin UID)', () => resetSession(null));

    // ── Control: sign-out only ──
    const control = await signInAndRead(recorder, 'Control');
    const controlBefore = await cachedBudgets(control.uid);
    recorder.check(
      'control: A en caché antes de salir',
      controlBefore > 0,
      `${controlBefore} doc(s)`,
    );
    await signOut(getAuth());
    const intruder = await createSyntheticUser('d3-intruso');
    const leaked = await cachedBudgets(control.uid);
    recorder.check(
      'control: sólo signOut → B lee la caché de A (fuga esperada)',
      true,
      `${leaked} doc(s) de A visibles para ${intruder.uid.slice(0, 6)}…; raíz: ${await cachedRoot(control.uid, control.budgetId)}`,
    );
    await signOut(getAuth());
    await resetSession(control.uid);

    // ── With resetSession ──
    const userA = await signInAndRead(recorder, 'A');
    const before = await cachedBudgets(userA.uid);
    recorder.check('A en caché antes del reset', before > 0, `${before} doc(s)`);
    recorder.check(
      'MMKV de A con datos',
      userStorage(userA.uid).getString('lastTab') === 'projects',
      userStorageId(userA.uid),
    );

    await recorder.step('resetSession(A)', () => resetSession(userA.uid));
    recorder.check(
      'MMKV de A borrado del disco',
      !existsMMKV(userStorageId(userA.uid)),
      `existsMMKV=${String(existsMMKV(userStorageId(userA.uid)))}`,
    );

    const userB = await recorder.step(
      'B: crear e iniciar sesión',
      () => createSyntheticUser('d3-b'),
      (value) => value.uid,
    );
    const afterCount = await cachedBudgets(userA.uid);
    const afterRoot = await cachedRoot(userA.uid, userA.budgetId);
    recorder.check(
      'B: getDocsFromCache(users/A/budgets) vacío',
      afterCount === 0,
      `${afterCount} doc(s); raíz: ${afterRoot}`,
    );
    recorder.check(
      'B: MMKV de A sigue sin existir',
      !existsMMKV(userStorageId(userA.uid)),
      `existsMMKV=${String(existsMMKV(userStorageId(userA.uid)))}`,
    );
    await recorder.step(
      'B: Firestore sigue operativo tras el reset (lectura en servidor)',
      () => getDocs(collection(getFirestore(), 'users', userB.uid, 'budgets')),
      (snapshot) => `${snapshot.docs.length} doc(s), fromCache=${snapshot.metadata.fromCache}`,
    );
    await resetSession(userB.uid);
  } catch {
    // Recorded by the failing step.
  }
  return recorder.finish();
}

const PROBE_KEY = 'd3.persistenceProbe';

/**
 * Disk persistence across app restarts: `write` signs in, reads a budget and remembers the UID;
 * after killing and relaunching the app, `probe` reads it with `source: cache` only.
 */
export async function runPersistenceProbe(phase: 'write' | 'probe'): Promise<SpikeResult> {
  const recorder = new SpikeRecorder(`d3-persistence-${phase}`);
  const spikeStorage = userStorage('spike-probe');
  try {
    if (phase === 'write') {
      const user = await signInAndRead(recorder, 'Persistencia');
      spikeStorage.set(PROBE_KEY, JSON.stringify({ uid: user.uid, budgetId: user.budgetId }));
      recorder.check('UID guardado para el reinicio', true, user.uid);
    } else {
      const saved = spikeStorage.getString(PROBE_KEY);
      if (!saved) throw new Error('Ejecuta antes la fase write.');
      const { uid, budgetId } = JSON.parse(saved) as { uid: string; budgetId: string };
      const count = await recorder.step(
        'getDocsFromCache tras reiniciar',
        () => cachedBudgets(uid),
        String,
      );
      recorder.check(
        'datos de la sesión anterior en disco',
        count > 0,
        `${count} doc(s); raíz: ${await cachedRoot(uid, budgetId)}`,
      );
      await recorder.step('resetSession(UID)', () => resetSession(uid));
      const after = await cachedBudgets(uid);
      recorder.check('tras resetSession la caché queda vacía', after === 0, `${after} doc(s)`);
      spikeStorage.remove(PROBE_KEY);
    }
  } catch {
    // Recorded by the failing step.
  }
  return recorder.finish();
}
