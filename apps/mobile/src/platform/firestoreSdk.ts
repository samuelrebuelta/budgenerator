import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import type { FirestoreSdk } from '@bg/firebase-api';

type NativeParent = Parameters<typeof doc>[0];

/**
 * RNFB 27 types `doc(documentReference, 'sub', 'id')` like the web SDK but implements it as
 * `parent.doc(path)`, which a `DocumentReference` does not have ("undefined is not a function",
 * found by the phase 0 spike). Resolve those paths from the Firestore root instead.
 */
const nativeDoc: FirestoreSdk['doc'] = (parent, path, ...pathSegments) => {
  const reference = parent as { doc?: unknown; firestore?: unknown; path?: string };
  if (typeof reference.doc === 'function' || !reference.firestore || !reference.path)
    return doc(parent as NativeParent, path as string, ...pathSegments);
  return doc(
    reference.firestore as NativeParent,
    [reference.path, path, ...pathSegments].filter(Boolean).join('/'),
  );
};

/**
 * React Native Firebase (modular API) injected into the shared repositories of
 * `@bg/firebase-api` (BG-014 D2, spike of phase 0). Same names as the web binding
 * (`src/shared/firebase/firestoreSdk.ts`).
 */
export const nativeFirestoreSdk: FirestoreSdk = {
  collection,
  deleteDoc,
  deleteField,
  doc: nativeDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
};
