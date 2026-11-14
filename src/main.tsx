import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { pwaInstall } from './app/pwaInstall';
pwaInstall.start();
import { registerPwa } from './app/pwa';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
window.dispatchEvent(new Event('cimbra:mounted'));
registerPwa();
