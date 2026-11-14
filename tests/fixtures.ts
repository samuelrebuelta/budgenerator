import { doc, setDoc, type Firestore } from 'firebase/firestore';
import {
  contentOf,
  encodeContent,
  type ConstructionDocument,
} from '../src/entities/construction-document/model';
import { sampleDocument, storedRoot } from '../packages/domain/tests/fixtures';

export * from '../packages/domain/tests/fixtures';

/** Seeds root + chunks (use inside `withSecurityRulesDisabled`). */
export async function seedStoredDocument(
  db: Firestore,
  path: string[],
  document: ConstructionDocument,
  extra: Record<string, unknown> = {},
) {
  const id = path.at(-1)!;
  const root = storedRoot(id, document, extra);
  const chunks = encodeContent(contentOf(document));
  await setDoc(doc(db, path.join('/')), root);
  await Promise.all(
    chunks.map((data, index) =>
      setDoc(doc(db, [...path, 'content', String(index)].join('/')), {
        index,
        revision: root.contentRevision,
        data,
      }),
    ),
  );
}

export function seedBudget(
  db: Firestore,
  uid: string,
  id: string,
  extra: Record<string, unknown> = {},
  document = sampleDocument('budget'),
) {
  return seedStoredDocument(db, ['users', uid, 'budgets', id], document, { number: 1, ...extra });
}
