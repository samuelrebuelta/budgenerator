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
} from 'firebase/firestore';
import type { FirestoreSdk } from '@bg/firebase-api';

/**
 * Firebase JS SDK functions injected into the shared repositories of `@bg/firebase-api`
 * (BG-014 D2). Named imports, not `import * as`, so the bundle keeps tree-shaking Firestore.
 */
export const webFirestoreSdk: FirestoreSdk = {
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
};
