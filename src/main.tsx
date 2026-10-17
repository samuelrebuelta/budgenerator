import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { i18nReady } from '@/shared/i18n';
import { pwaInstall } from './app/pwaInstall';
pwaInstall.start();
import { registerPwa } from './app/pwa';
void i18nReady.catch((error) => console.error('No se han podido cargar las traducciones', error));
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
window.dispatchEvent(new Event('cimbra:mounted'));
registerPwa();
