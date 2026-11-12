// Compatibility facade: each service lives in its own module so that a route only loads
// the Firebase SDKs it uses.
export { firebaseApp } from './app';
export { auth } from './auth';
export { db } from './firestore';
export { functions } from './functions';
