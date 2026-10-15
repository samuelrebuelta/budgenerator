import i18next from 'i18next';
import es from '../../../public/locales/es/translation.json';
// Bundle the boot language: an unavailable HTTP translation must never block React.
export const i18nReady = i18next.init({
  lng: 'es',
  fallbackLng: 'es',
  resources: { es: { translation: es } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
export const t = i18next.t.bind(i18next);
