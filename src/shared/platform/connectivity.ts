import { setConnectivityPort } from '@bg/app-core/network';
import { browserConnectivity } from './browser';

/** Installs `navigator.onLine` as the app-core connectivity (imported by the network model). */
setConnectivityPort(browserConnectivity);
