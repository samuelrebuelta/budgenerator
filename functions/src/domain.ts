/**
 * Single entry from Functions to `@bg/domain` (BG-014).
 *
 * Functions deploys from `functions/` with its own lockfile and no access to the root pnpm
 * workspace, so a `@bg/domain` package import would not resolve in Cloud Build. tsc compiles
 * the domain sources reached from here (see `include` in tsconfig.json) into
 * `lib/packages/domain/src`, and this shim keeps the relative paths in one place.
 * Only the BC3 model, the estimator and the data contracts are re-exported: the rest of the
 * domain is not needed on the server.
 */
export * from '../../packages/domain/src/types/index.js';
export * from '../../packages/domain/src/construction-document/index.js';
export * from '../../packages/domain/src/quote-estimator/estimate.js';
export * from '../../packages/domain/src/quote-estimator/leads.js';
export * from '../../packages/domain/src/quote-estimator/sharing.js';
export * from '../../packages/domain/src/quote-estimator/types.js';
