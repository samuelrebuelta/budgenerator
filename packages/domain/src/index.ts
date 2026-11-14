/**
 * Core entry of `@bg/domain`: data contracts, money, dates, formatting and copy.
 * Areas with overlapping names (BC3 model, catalog, projects, estimator, team, PDF) are
 * imported from their subpath, e.g. `@bg/domain/construction-document` or
 * `@bg/domain/project/progress`.
 */
export * from './types/index.js';
export * from './lib/budgetMath.js';
export * from './lib/dateKey.js';
export * from './lib/format.js';
export * from './lib/text.js';
export * from './lib/utils.js';
export * from './i18n/index.js';
