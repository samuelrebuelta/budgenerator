// Compatibility facade: each service lives in its own module so that a route only loads
// the Firebase SDKs it uses.
export { firebaseApp, appCheckEnabled } from './app';
export { auth } from './auth';
export { db } from './firestore';
export { functions, FUNCTIONS_REGION } from './functions';
