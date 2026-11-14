import { initFirebase } from './firebase';
import { registerIdGenerator } from './ids';

/**
 * Side effects that must run before any store or repository module loads (imported by the root
 * layout right after the polyfills): the UUID source of `@bg/domain` and the native Firebase
 * connection (emulators and the `demo-*` guard in development).
 */
registerIdGenerator();
initFirebase();
