import { getApp } from '@react-native-firebase/app';
import {
  contentOf,
  encodeContent,
  type ConstructionDocument,
} from '@bg/domain/construction-document';
import { EMULATOR_PORTS, emulatorHost } from '../platform/firebase';
import { appVariant } from '../platform/variant';

/**
 * Development only: writes seed data straight into the Firestore emulator through its REST API
 * with the `owner` token, which bypasses the rules (like `withSecurityRulesDisabled` in the rules
 * tests). Refuses to run outside `development` or against a non `demo-*` project.
 */
type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function encode(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as object) } };
  throw new Error(`Tipo no admitido en la semilla: ${typeof value}`);
}

function encodeFields(data: object): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encode(value)]),
  );
}

function emulatorBase(): string {
  const projectId = getApp().options.projectId ?? '';
  if (appVariant !== 'development' || !projectId.startsWith('demo-'))
    throw new Error('La siembra sólo se permite en development contra un emulador demo-*.');
  return `http://${emulatorHost()}:${EMULATOR_PORTS.firestore}/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function seedDocument(path: string, data: object): Promise<void> {
  const response = await fetch(`${emulatorBase()}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!response.ok)
    throw new Error(`Siembra ${path}: HTTP ${response.status} ${await response.text()}`);
}

/** Root + content chunks exactly as `construction-document/api/storage` writes them. */
export async function seedStoredDocument(
  path: string,
  document: ConstructionDocument,
  extra: Record<string, unknown> = {},
  createdAt = '2026-11-14T08:00:00.000Z',
): Promise<void> {
  const chunks = encodeContent(contentOf(document));
  const { business } = document;
  await seedDocument(path, {
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
    ...extra,
  });
  await Promise.all(
    chunks.map((data, index) =>
      seedDocument(`${path}/content/${index}`, { index, revision: 1, data }),
    ),
  );
}
