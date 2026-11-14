import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import type { FunctionsPort } from '@bg/firebase-api/functionsPort';
import { FUNCTIONS_REGION } from './firebase';

/**
 * Callables of the native Functions instance in `europe-southwest1` for the shared repositories
 * (`@bg/firebase-api`), like `webFunctions` on the web.
 */
export const nativeFunctions: FunctionsPort = {
  httpsCallable: (name, options) =>
    httpsCallable(getFunctions(getApp(), FUNCTIONS_REGION), name, options),
};
