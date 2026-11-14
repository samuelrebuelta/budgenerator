import { configureOfflineStorage } from '@bg/app-core/offlineStateCache';
import { indexedDbStore } from './indexedDbStore';
import { pageLifecycle } from './browser';

/**
 * Installs IndexedDB and the page lifecycle as the app-core offline storage. Only the modules
 * of the authenticated session import it, so public routes do not load the offline cache.
 */
configureOfflineStorage(indexedDbStore, { lifecycle: pageLifecycle });
