import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { i18nReady } from '@/shared/i18n'

i18nReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
