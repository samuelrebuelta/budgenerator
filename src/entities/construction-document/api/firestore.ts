import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/firebase/config';
import { FREE_BUDGET_LIMIT, getBudgetSlotsUsed } from '@/shared/lib/utils';
import { validateConstructionDocument } from '../model/invariants';
import type { ConstructionDocument, FiebdcNode } from '../model/types';

const MAX_BATCH_WRITES = 400;
const MAX_DOCUMENT_BYTES = 850_000;

export interface StagedConstructionDocument {
  uid: string;
  id: string;
  revisionId: string;
  kind: ConstructionDocument['kind'];
}

function documentCollection(uid: string) {
  return collection(db, 'users', uid, 'constructionDocuments');
}

function documentRef(uid: string, id: string) {
  return doc(documentCollection(uid), id);
}

function revisionCollection(uid: string, id: string) {
  return collection(documentRef(uid, id), 'revisions');
}

function revisionRef(uid: string, id: string, revisionId: string) {
  return doc(revisionCollection(uid, id), revisionId);
}

function safeDocument<T extends DocumentData>(snapshot: QueryDocumentSnapshot<T>) {
  return snapshot.data();
}

function assertSize(data: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  if (bytes > MAX_DOCUMENT_BYTES)
    throw new Error(
      `Un elemento del documento supera el límite seguro de ${MAX_DOCUMENT_BYTES} bytes.`,
    );
}

function flattenNodes(roots: FiebdcNode[]) {
  const flat: Array<{
    id: string;
    conceptCode: string;
    parentId: string | null;
    position: number;
    measurements: FiebdcNode['measurements'];
  }> = [];
  const visit = (node: FiebdcNode, parentId: string | null, position: number) => {
    flat.push({
      id: node.id,
      conceptCode: node.conceptCode,
      parentId,
      position,
      measurements: node.measurements,
    });
    node.children.forEach((child, index) => visit(child, node.id, index));
  };
  roots.forEach((root, index) => visit(root, null, index));
  return flat;
}

async function commitDocuments(
  documents: Array<{ ref: ReturnType<typeof doc>; data: DocumentData }>,
) {
  for (let offset = 0; offset < documents.length; offset += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    documents
      .slice(offset, offset + MAX_BATCH_WRITES)
      .forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
}

export async function stageConstructionDocument(
  uid: string,
  document: ConstructionDocument,
): Promise<StagedConstructionDocument> {
  const issues = validateConstructionDocument(document);
  if (issues.length) throw new Error(issues[0]?.message ?? 'El documento FIEBDC no es válido.');
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(document.id))
    throw new Error('El identificador interno del documento no es válido.');

  const rootRef = documentRef(uid, document.id);
  const rootSnapshot = await getDoc(rootRef);
  const isNew = !rootSnapshot.exists();
  if (isNew) {
    await setDoc(rootRef, {
      id: document.id,
      kind: document.kind,
      state: 'staging',
      createdAt: new Date().toISOString(),
    });
  } else if (rootSnapshot.data().state !== 'ready') {
    throw new Error('Ya hay una importación pendiente con ese identificador.');
  }

  const revisionId = crypto.randomUUID();
  const revision = revisionRef(uid, document.id, revisionId);
  const revisionData = {
    id: revisionId,
    schemaVersion: document.schemaVersion,
    kind: document.kind,
    header: document.header,
    coefficients: document.coefficients,
    business: document.business,
    rootNodeIds: document.roots.map((node) => node.id),
    state: 'staging',
    conceptCount: Object.keys(document.concepts).length,
    nodeCount: flattenNodes(document.roots).length,
    extensionCount: document.opaqueRecords.length,
    createdAt: new Date().toISOString(),
  };
  try {
    assertSize(revisionData);
    await setDoc(revision, revisionData);

    const records: Array<{ ref: ReturnType<typeof doc>; data: DocumentData }> = [];
    for (const concept of Object.values(document.concepts)) {
      assertSize(concept);
      records.push({ ref: doc(collection(revision, 'concepts'), concept.id), data: concept });
    }
    for (const node of flattenNodes(document.roots)) {
      assertSize(node);
      records.push({ ref: doc(collection(revision, 'nodes'), node.id), data: node });
    }
    for (const [index, extension] of document.opaqueRecords.entries()) {
      assertSize(extension);
      records.push({
        ref: doc(collection(revision, 'extensions'), `record-${index}`),
        data: { ...extension, order: index },
      });
    }
    await commitDocuments(records);
  } catch (error) {
    await deleteSubcollections(revision).catch(() => undefined);
    await deleteDoc(revision).catch(() => undefined);
    if (isNew) await deleteDoc(rootRef).catch(() => undefined);
    throw error;
  }
  return { uid, id: document.id, revisionId, kind: document.kind };
}

export async function publishConstructionDocument(
  staged: StagedConstructionDocument,
): Promise<void> {
  const rootRef = documentRef(staged.uid, staged.id);
  const revision = revisionRef(staged.uid, staged.id, staged.revisionId);
  const userRef = doc(db, 'users', staged.uid);
  await runTransaction(db, async (transaction) => {
    const [rootSnapshot, revisionSnapshot, userSnapshot] = await Promise.all([
      transaction.get(rootRef),
      transaction.get(revision),
      staged.kind === 'budget' ? transaction.get(userRef) : Promise.resolve(null),
    ]);
    if (!rootSnapshot.exists() || !revisionSnapshot.exists())
      throw new Error('La importación ya no está disponible. Vuelve a seleccionar el archivo.');
    if (revisionSnapshot.data().state !== 'staging') {
      if (rootSnapshot.data().activeRevisionId === staged.revisionId) return;
      throw new Error('La revisión no está en estado de publicación.');
    }
    const wasReady = rootSnapshot.data().state === 'ready';
    if (staged.kind === 'budget' && !wasReady) {
      if (!userSnapshot?.exists()) throw new Error('No se ha podido cargar tu cuenta.');
      const user = userSnapshot.data();
      const account = user.accountData;
      const premium =
        account.plan === 'premium' &&
        (!account.premiumExpiresAt || Date.parse(account.premiumExpiresAt) > Date.now());
      if (!premium && getBudgetSlotsUsed(user.totalBudgetsCreated) >= FREE_BUDGET_LIMIT)
        throw new Error('Has alcanzado el límite de presupuestos de tu plan.');
      transaction.update(userRef, {
        totalBudgetsCreated: user.totalBudgetsCreated + 1,
        lastCreatedBudgetId: staged.id,
      });
    }
    const revisionData = revisionSnapshot.data();
    transaction.update(revision, { state: 'ready', publishedAt: new Date().toISOString() });
    transaction.set(rootRef, {
      ...rootSnapshot.data(),
      id: staged.id,
      kind: staged.kind,
      state: 'ready',
      activeRevisionId: staged.revisionId,
      title: revisionData.header.title,
      updatedAt: new Date().toISOString(),
      conceptCount: revisionData.conceptCount,
      nodeCount: revisionData.nodeCount,
      ...(revisionData.business.acceptedAt ? { acceptedAt: revisionData.business.acceptedAt } : {}),
      ...(revisionData.business.projectId ? { projectId: revisionData.business.projectId } : {}),
    });
  });
}

export async function discardStagedConstructionDocument(
  uid: string,
  staged: Pick<StagedConstructionDocument, 'id' | 'revisionId'>,
) {
  const revision = revisionRef(uid, staged.id, staged.revisionId);
  await deleteSubcollections(revision);
  await deleteDoc(revision);
  const root = documentRef(uid, staged.id);
  const rootSnapshot = await getDoc(root);
  if (
    rootSnapshot.exists() &&
    rootSnapshot.data().state === 'staging' &&
    !rootSnapshot.data().activeRevisionId
  )
    await deleteDoc(root);
}

async function deleteCollection(parent: ReturnType<typeof doc>, name: string) {
  const snapshot = await getDocs(collection(parent, name));
  for (let offset = 0; offset < snapshot.docs.length; offset += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    snapshot.docs
      .slice(offset, offset + MAX_BATCH_WRITES)
      .forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

async function deleteSubcollections(parent: ReturnType<typeof doc>) {
  const revisions = await getDocs(collection(parent, 'revisions'));
  for (const revision of revisions.docs) {
    await deleteSubcollections(revision.ref);
    await deleteDoc(revision.ref);
  }
  for (const name of ['concepts', 'nodes', 'extensions']) {
    const snapshot = await getDocs(collection(parent, name));
    if (!snapshot.empty) await deleteCollection(parent, name);
  }
}

export async function loadConstructionDocument(
  uid: string,
  id: string,
): Promise<ConstructionDocument> {
  const rootSnapshot = await getDoc(documentRef(uid, id));
  if (!rootSnapshot.exists() || rootSnapshot.data().state !== 'ready')
    throw new Error('No se encuentra el documento o todavía no está listo.');
  const activeRevisionId = rootSnapshot.data().activeRevisionId as string | undefined;
  if (!activeRevisionId) throw new Error('El documento no tiene una revisión publicada.');
  const revision = revisionRef(uid, id, activeRevisionId);
  const [revisionSnapshot, conceptsSnapshot, nodesSnapshot, extensionsSnapshot] = await Promise.all(
    [
      getDoc(revision),
      getDocs(query(collection(revision, 'concepts'), orderBy('id'))),
      getDocs(query(collection(revision, 'nodes'), orderBy('position'))),
      getDocs(query(collection(revision, 'extensions'), orderBy('order'))),
    ],
  );
  if (!revisionSnapshot.exists() || revisionSnapshot.data().state !== 'ready')
    throw new Error('No se encuentra la revisión publicada del documento.');

  const flatNodes = nodesSnapshot.docs.map(
    (snapshot) =>
      snapshot.data() as {
        id: string;
        conceptCode: string;
        parentId: string | null;
        position: number;
        measurements: FiebdcNode['measurements'];
      },
  );
  const nodeMap = new Map(
    flatNodes.map((node) => [node.id, { ...node, children: [] as FiebdcNode[] }]),
  );
  for (const node of flatNodes) {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (!parent)
        throw new Error('La estructura almacenada contiene una referencia de nodo inexistente.');
      parent.children.push(nodeMap.get(node.id)!);
    }
  }
  for (const node of nodeMap.values())
    node.children.sort(
      (a, b) =>
        ((a as FiebdcNode & { position?: number }).position ?? 0) -
        ((b as FiebdcNode & { position?: number }).position ?? 0),
    );
  const revisionData = revisionSnapshot.data();
  const roots = (revisionData.rootNodeIds as string[])
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  if (roots.length !== (revisionData.rootNodeIds as string[]).length)
    throw new Error('La estructura almacenada tiene una raíz inexistente.');

  return {
    id,
    schemaVersion: revisionData.schemaVersion,
    kind: revisionData.kind,
    header: revisionData.header,
    concepts: Object.fromEntries(
      conceptsSnapshot.docs.map((snapshot) => [snapshot.id, safeDocument(snapshot)]),
    ) as ConstructionDocument['concepts'],
    roots,
    coefficients: revisionData.coefficients ?? [],
    opaqueRecords: extensionsSnapshot.docs
      .map((snapshot) => safeDocument(snapshot))
      .sort((a, b) => a.order - b.order),
    business: revisionData.business ?? {},
  } as unknown as ConstructionDocument;
}

export async function listConstructionDocuments(uid: string, kind?: ConstructionDocument['kind']) {
  const snapshot = await getDocs(query(documentCollection(uid), where('state', '==', 'ready')));
  return snapshot.docs
    .map((item) => item.data())
    .filter((item) => !kind || item.kind === kind)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

export async function deleteConstructionDocument(uid: string, id: string) {
  const root = documentRef(uid, id);
  const snapshot = await getDoc(root);
  if (!snapshot.exists()) return;
  if (
    snapshot.data().kind === 'budget' &&
    (snapshot.data().acceptedAt || snapshot.data().projectId)
  )
    throw new Error('No se puede eliminar un presupuesto aceptado o vinculado a un proyecto.');
  await setDoc(root, { ...snapshot.data(), state: 'deleting' });
  await deleteSubcollections(root);
  await deleteDoc(root);
}
