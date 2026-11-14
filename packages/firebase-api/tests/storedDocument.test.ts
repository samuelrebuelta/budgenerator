import { describe, expect, it } from 'vitest';
import { contentOf, encodeContent } from '@bg/domain/construction-document';
import type { DocumentData, DocumentReferenceLike, FirestoreSdk } from '../src/firestorePort';
import { readStoredDocument } from '../src/storedDocument';
import { sampleDocument, storedRoot } from '../../domain/tests/fixtures';

/** In-memory port: only what `readStoredDocument` uses (`doc`, `getDoc`). */
function memoryPort(data: Map<string, DocumentData>) {
  const reference = (path: string): DocumentReferenceLike => ({
    path,
    id: path.split('/').at(-1)!,
  });
  const sdk = {
    doc: (parent: { path?: string }, ...segments: (string | undefined)[]) =>
      reference([parent.path, ...segments].filter(Boolean).join('/')),
    getDoc: async ({ path, id }: DocumentReferenceLike) => {
      const value = data.get(path);
      return { id, exists: () => value !== undefined, data: () => value };
    },
  } as unknown as FirestoreSdk;
  return { sdk, reference };
}

describe('readStoredDocument con el SDK inyectado', () => {
  const document = sampleDocument('budget');
  const chunks = encodeContent(contentOf(document));

  function seed(chunkRevision = 1) {
    const data = new Map<string, DocumentData>();
    data.set('users/u/budgets/b', storedRoot('b', document, { number: 1 }));
    chunks.forEach((chunk, index) =>
      data.set(`users/u/budgets/b/content/${index}`, {
        index,
        revision: chunkRevision,
        data: chunk,
      }),
    );
    return data;
  }

  it('lee la raíz y los fragmentos con el puerto', async () => {
    const { sdk, reference } = memoryPort(seed());
    const stored = await readStoredDocument(sdk, reference('users/u/budgets/b'));
    expect(stored?.root.id).toBe('b');
    expect(stored?.document.business.clientName).toBe(document.business.clientName);
    expect(contentOf(stored!.document)).toEqual(contentOf(document));
  });

  it('devuelve null si no existe y falla si los fragmentos no son coherentes', async () => {
    const { sdk, reference } = memoryPort(seed(2));
    await expect(readStoredDocument(sdk, reference('users/u/budgets/x'))).resolves.toBeNull();
    await expect(readStoredDocument(sdk, reference('users/u/budgets/b'))).rejects.toThrow(
      'versión coherente',
    );
  });
});
