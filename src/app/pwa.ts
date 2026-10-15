export type PwaUpdateEvent = CustomEvent<ServiceWorkerRegistration>;
export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) {
    // Old development installs must not intercept Vite/HMR or module requests.
    void navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => {
        if (registration?.active?.scriptURL === location.origin + '/sw.js')
          return registration.unregister();
      })
      .catch(() => {});
    return;
  }
  void navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      const announce = () => {
        if (registration.waiting && navigator.serviceWorker.controller)
          window.dispatchEvent(new CustomEvent('cimbra:update', { detail: registration }));
      };
      announce();
      registration.addEventListener('updatefound', () =>
        registration.installing?.addEventListener('statechange', announce),
      );
      const update = () => {
        if (document.visibilityState === 'visible' && navigator.onLine)
          void registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', update);
      window.addEventListener('online', update);
      const timer = setInterval(update, 60 * 60 * 1000);
      window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    })
    .catch((error) => console.warn('La instalación offline no está disponible:', error));
}
