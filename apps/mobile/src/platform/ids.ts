import { setIdGenerator } from '@bg/domain';
import { randomUUID } from 'expo-crypto';

/**
 * `@bg/domain`'s `generateId` uses `crypto.randomUUID` when the runtime has it and otherwise the
 * registered generator; Hermes does not expose Web Crypto, so register `expo-crypto`.
 */
export function registerIdGenerator() {
  setIdGenerator(randomUUID);
}
