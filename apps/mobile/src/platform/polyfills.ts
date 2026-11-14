/**
 * Polyfills that Hermes needs for `@bg/domain`. Import this module first (app/_layout.tsx): the
 * domain creates an `Intl.PluralRules('es')` when `i18n` loads.
 *
 * Checked on the iOS simulator (Expo SDK 58, RN 0.88): Hermes has no `Intl.PluralRules`, so `t()`
 * crashed at import time. The conditional polyfills only install when the engine lacks the API;
 * `Intl.Locale` and `getCanonicalLocales` are prerequisites of the plural rules polyfill.
 * `structuredClone`, `URL` and `URLSearchParams` come from Expo's runtime; `TextEncoder` and
 * `TextDecoder` (UTF-8) from Hermes.
 */
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
