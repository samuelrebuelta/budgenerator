(() => {
  let mounted = false;
  window.addEventListener('cimbra:mounted', () => {
    mounted = true;
  });
  setTimeout(() => {
    if (mounted) return;
    const recovery = document.getElementById('boot-recovery');
    if (recovery) recovery.hidden = false;
  }, 12000);
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('#repair-app')) return;
    const button = document.getElementById('repair-app');
    button.disabled = true;
    button.textContent = 'Preparando…';
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith('cimbra-shell-') || key === 'budgenerator-v1')
            .map((key) => caches.delete(key)),
        );
      }
      location.reload();
    } catch {
      button.disabled = false;
      button.textContent = 'Reintentar recuperación';
    }
  });
})();
