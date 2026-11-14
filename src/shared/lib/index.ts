export { cn, formatCurrency, generateId, CONTACT_EMAIL, MAX_LOGO_SIZE } from './utils';
export * from './format';
export * from './dateKey';
export { compareSpanish, normalizeCatalogText } from './text';
export { UserFacingError, toUserMessage, type UserMessageContext } from './errors';
// Data hooks with cache and network dependencies are imported from their own module so that
// this barrel stays free of IndexedDB and store code: `@/shared/lib/useMemoryResource`.
