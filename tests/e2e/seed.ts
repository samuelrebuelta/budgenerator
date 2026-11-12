import { doc, setDoc, type Firestore } from 'firebase/firestore';
import {
  addCatalogConcept,
  addChapter,
  addItem,
  contentOf,
  createEmptyDocument,
  encodeContent,
  type ConstructionBusiness,
  type ConstructionDocument,
  type ItemInput,
} from '../../src/entities/construction-document/model/index.js';

export interface SeedChapter {
  name: string;
  items: ItemInput[];
}

export function seedDocument(
  kind: ConstructionDocument['kind'],
  business: Partial<ConstructionBusiness>,
  chapters: SeedChapter[],
) {
  let document = createEmptyDocument(kind, business);
  for (const chapter of chapters) {
    const added = addChapter(document, chapter.name);
    document = added.document;
    for (const item of chapter.items)
      document =
        kind === 'catalog'
          ? addCatalogConcept(document, added.chapterId, item).document
          : addItem(document, added.chapterId, item).document;
  }
  return document;
}

/** Writes a canonical document (root + content chunks) exactly as the app stores it. */
export async function writeStoredDocument(
  db: Firestore,
  path: string,
  document: ConstructionDocument,
  extra: Record<string, unknown> = {},
  createdAt = '2026-10-01T10:00:00Z',
) {
  const chunks = encodeContent(contentOf(document));
  const { business } = document;
  await setDoc(doc(db, path), {
    id: path.split('/').at(-1),
    kind: document.kind,
    schemaVersion: 1,
    revision: 1,
    contentRevision: 1,
    chunkCount: chunks.length,
    createdAt,
    updatedAt: createdAt,
    name: business.name,
    clientName: business.clientName,
    address: business.address,
    date: business.date,
    budgetNumber: business.budgetNumber,
    ivaRate: business.ivaRate,
    ...(business.adjustment ? { adjustment: business.adjustment } : {}),
    ...extra,
  });
  await Promise.all(
    chunks.map((data, index) =>
      setDoc(doc(db, `${path}/content/${index}`), { index, revision: 1, data }),
    ),
  );
}
