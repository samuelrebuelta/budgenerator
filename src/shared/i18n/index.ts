import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';

export const i18nReady = i18next.use(HttpBackend).init({
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
});

export const t = i18next.t.bind(i18next);
