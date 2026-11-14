import type {
  CollectionReferenceLike,
  DocumentData,
  DocumentReferenceLike,
  DocumentSnapshotLike,
  FirestoreSdk,
  QueryDocumentSnapshotLike,
  TransactionLike,
} from '../src/firestorePort';

const DELETE = Symbol('deleteField');
const SERVER_TIME = Symbol('serverTimestamp');

/**
 * In-memory Firestore behind the `FirestoreSdk` port: paths, subcollections, transactions
 * (applied on commit), batches and the two sentinels. Enough to exercise the repositories'
 * logic without an SDK; the real SDKs run against the emulator in `test:rules`/`test:e2e`.
 */
export function memoryFirestore() {
  const data = new Map<string, DocumentData>();
  const database = { path: '' };
  const reference = (path: string): DocumentReferenceLike & CollectionReferenceLike => ({
    path,
    id: path.split('/').at(-1)!,
    firestore: database,
  });
  const join = (parent: { path?: string }, segments: (string | undefined)[]) =>
    [parent.path, ...segments].filter(Boolean).join('/');
  const snapshot = (path: string): DocumentSnapshotLike & QueryDocumentSnapshotLike => {
    const value = data.get(path);
    return {
      id: path.split('/').at(-1)!,
      ref: reference(path),
      exists: () => value !== undefined,
      data: () => (value ? structuredClone(value) : (undefined as unknown as DocumentData)),
    };
  };
  const resolve = (value: DocumentData, previous: DocumentData = {}) => {
    const next: DocumentData = { ...previous };
    for (const [key, field] of Object.entries(value)) {
      if (field === DELETE) delete next[key];
      else if (field === SERVER_TIME) next[key] = '2026-11-14T00:00:00.000Z';
      else if (field && typeof field === 'object' && !Array.isArray(field))
        next[key] = resolve(field as DocumentData, {});
      else next[key] = field;
    }
    return next;
  };
  const write = {
    set: (ref: DocumentReferenceLike, value: DocumentData, options?: { merge?: boolean }) =>
      data.set(ref.path, resolve(value, options?.merge ? data.get(ref.path) : {})),
    update: (ref: DocumentReferenceLike, value: DocumentData) => {
      const current = data.get(ref.path);
      if (!current) throw Object.assign(new Error('not-found'), { code: 'not-found' });
      data.set(ref.path, resolve(value, current));
    },
    delete: (ref: DocumentReferenceLike) => data.delete(ref.path),
  };
  const children = (path: string) =>
    [...data.keys()]
      .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
      .sort()
      .map(snapshot);

  const sdk = {
    collection: (parent: { path?: string }, ...segments: string[]) =>
      reference(join(parent, segments)),
    doc: (parent: { path?: string }, ...segments: (string | undefined)[]) =>
      reference(join(parent, segments)),
    getDoc: async (ref: DocumentReferenceLike) => snapshot(ref.path),
    getDocFromServer: async (ref: DocumentReferenceLike) => snapshot(ref.path),
    getDocs: async (query: { path: string }) => ({ docs: children(query.path) }),
    getDocsFromServer: async (query: { path: string }) => ({ docs: children(query.path) }),
    setDoc: async (
      ref: DocumentReferenceLike,
      value: DocumentData,
      options?: { merge?: boolean },
    ) => void write.set(ref, value, options),
    updateDoc: async (ref: DocumentReferenceLike, value: DocumentData) =>
      void write.update(ref, value),
    deleteDoc: async (ref: DocumentReferenceLike) => void write.delete(ref),
    deleteField: () => DELETE,
    serverTimestamp: () => SERVER_TIME,
    query: (query: unknown) => query,
    where: () => ({ type: 'where' }),
    writeBatch: () => {
      const operations: (() => void)[] = [];
      return {
        delete: (ref: DocumentReferenceLike) => operations.push(() => write.delete(ref)),
        commit: async () => operations.forEach((operation) => operation()),
      };
    },
    runTransaction: async <T>(_db: unknown, update: (tx: TransactionLike) => Promise<T>) => {
      const operations: (() => void)[] = [];
      const transaction: TransactionLike = {
        get: async (ref) => snapshot(ref.path),
        set: (ref, value) => operations.push(() => write.set(ref, value)),
        update: (ref, value) => operations.push(() => write.update(ref, value)),
        delete: (ref) => operations.push(() => write.delete(ref)),
      };
      const result = await update(transaction);
      operations.forEach((operation) => operation());
      return result;
    },
  } as unknown as FirestoreSdk;

  return { sdk, database, data, reference };
}
