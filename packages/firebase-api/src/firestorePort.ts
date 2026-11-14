/**
 * Minimal Firestore surface the shared repositories need (BG-014 D2). The web injects the
 * modular `firebase/firestore` functions and the app injects `@react-native-firebase/firestore`
 * (modular API, v22+). Both expose the same function names and call shapes; only their classes
 * differ, so the types below are structural and deliberately loose:
 *
 * - Members use method syntax so that TypeScript compares parameters bivariantly. That is what
 *   lets each SDK's overloaded, generic functions (`doc`, `collection`, `getDoc<A, D>`…) satisfy
 *   one signature. The price is that the port cannot stop mixing references of two SDKs; each
 *   runtime only ever has one.
 * - `DocumentData` is `any` per field, as in both SDKs: repository code keeps its casts to domain
 *   types (`as Project`) exactly as with the web SDK.
 * - `FieldValue` sentinels (`deleteField()`) are opaque values the repository only passes back.
 *
 * Observed differences that do not reach this port (spike, docs/specs/plans/2026-11-14-bg-014-spikes.md):
 * `Timestamp` classes differ, but the repositories store ISO strings; cache-only reads
 * (`getDocsFromCache`), `terminate` and `clearPersistence` are session concerns of each platform.
 */

// Same shape as `DocumentData` in both SDKs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocumentData = { [field: string]: any };

/** A `Firestore` instance of either SDK; the repositories only hand it back to the SDK. */
export type FirestoreLike = object;

export interface DocumentReferenceLike {
  readonly id: string;
  readonly path: string;
}

/** Queries and collection references; only passed back to `getDocs`/`query`. */
export interface QueryLike {
  readonly firestore: unknown;
}

export interface CollectionReferenceLike extends QueryLike {
  readonly id: string;
  readonly path: string;
}

/** Result of `where(...)`; only passed back to `query`. */
export interface QueryConstraintLike {
  readonly type: string;
}

export interface DocumentSnapshotLike {
  readonly id: string;
  exists(): this is QueryDocumentSnapshotLike;
  data(): DocumentData | undefined;
}

export interface QueryDocumentSnapshotLike extends DocumentSnapshotLike {
  /** Reference of the document; used to read its subcollections and content chunks. */
  readonly ref: DocumentReferenceLike;
  data(): DocumentData;
}

export interface QuerySnapshotLike {
  readonly docs: QueryDocumentSnapshotLike[];
}

export interface TransactionLike {
  get(reference: DocumentReferenceLike): Promise<DocumentSnapshotLike>;
  set(reference: DocumentReferenceLike, data: DocumentData): unknown;
  update(reference: DocumentReferenceLike, data: DocumentData): unknown;
  delete(reference: DocumentReferenceLike): unknown;
}

/** `writeBatch(database)`: only deletes are batched today (`deleteStoredDocument`). */
export interface WriteBatchLike {
  delete(reference: DocumentReferenceLike): unknown;
  commit(): Promise<void>;
}

/** Options of `setDoc`; the repositories only merge. */
export interface SetOptionsLike {
  readonly merge?: boolean;
}

export type WhereFilterOpLike =
  '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

export interface FirestoreSdk {
  collection(
    parent: FirestoreLike | DocumentReferenceLike | CollectionReferenceLike,
    path: string,
    ...pathSegments: string[]
  ): CollectionReferenceLike;
  doc(
    parent: FirestoreLike | DocumentReferenceLike | CollectionReferenceLike,
    path?: string,
    ...pathSegments: string[]
  ): DocumentReferenceLike;
  getDoc(reference: DocumentReferenceLike): Promise<DocumentSnapshotLike>;
  getDocFromServer(reference: DocumentReferenceLike): Promise<DocumentSnapshotLike>;
  getDocs(query: QueryLike): Promise<QuerySnapshotLike>;
  getDocsFromServer(query: QueryLike): Promise<QuerySnapshotLike>;
  setDoc(
    reference: DocumentReferenceLike,
    data: DocumentData,
    options?: SetOptionsLike,
  ): Promise<void>;
  updateDoc(reference: DocumentReferenceLike, data: DocumentData): Promise<void>;
  deleteDoc(reference: DocumentReferenceLike): Promise<void>;
  deleteField(): unknown;
  /** Server time sentinel; Rules compare it with `request.time`. */
  serverTimestamp(): unknown;
  query(query: QueryLike, ...constraints: QueryConstraintLike[]): QueryLike;
  where(fieldPath: string, opStr: WhereFilterOpLike, value: unknown): QueryConstraintLike;
  writeBatch(database: FirestoreLike): WriteBatchLike;
  runTransaction<T>(
    database: FirestoreLike,
    updateFunction: (transaction: TransactionLike) => Promise<T>,
  ): Promise<T>;
}

/**
 * Wraps a mutation so the platform can block it offline and report network errors (web:
 * `guardNetworkMutation`, BG-012). The identity is valid where nothing has to be blocked.
 */
export type MutationGuard = <TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
) => (...args: TArgs) => Promise<TResult>;

export const unguardedMutation: MutationGuard = (operation) => operation;

/** Runs one operation through the guard (the web's `runNetworkMutation`). */
export function runGuarded<T>(guard: MutationGuard, operation: () => Promise<T>): Promise<T> {
  return guard(operation)();
}
