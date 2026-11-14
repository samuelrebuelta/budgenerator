/**
 * Web adapters of the `@bg/app-core` ports (BG-014). Importing a module installs its port:
 * `connectivity` (network model, public routes included) and `offlineStorage` (session stores
 * and caches). The entity store bindings import this index, which installs both.
 */
import './connectivity';
import './offlineStorage';

export { browserConnectivity, pageLifecycle, sessionDraftStorage } from './browser';
export { canvasLogoNormalizer } from './imageNormalizer';
export { indexedDbStore } from './indexedDbStore';
