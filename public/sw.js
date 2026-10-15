/* Generated at build time with an immutable, release-specific app shell. */
const VERSION = '__CIMBRA_VERSION__';
const CACHE = `cimbra-shell-${VERSION}`;
const PRECACHE = /* __CIMBRA_PRECACHE__ */ [];
const assetPaths = new Set(PRECACHE);
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(PRECACHE);
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
  // Keep the previous release active until the user chooses to update.
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const previous = names
        .filter((name) => name.startsWith('cimbra-shell-') && name !== CACHE)
        .slice(-1);
      await Promise.all(
        names
          .filter(
            (name) =>
              name === 'budgenerator-v1' ||
              (name.startsWith('cimbra-shell-') && name !== CACHE && !previous.includes(name)),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
async function network(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache Firebase requests, tokens, user documents, or other origins.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/__/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const shell = await cache.match('/index.html');
        if (shell) return shell;
        try {
          const response = await network(event.request);
          if (response.ok) return response;
        } catch {
          /* A bounded, useful fallback instead of a rejected response. */
        }
        return (
          (await cache.match('/offline.html')) ||
          new Response('Sin conexión. Vuelve a abrir budgenerator cuando recuperes la red.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      })(),
    );
  } else if (
    assetPaths.has(url.pathname) ||
    /^\/assets\/[a-zA-Z0-9._-]+\.(js|css|woff2|png|svg)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        // An older tab can request its own lazy chunks after an update activates.
        for (const name of await caches.keys()) {
          if (name.startsWith('cimbra-shell-') && name !== CACHE) {
            const previous = await (await caches.open(name)).match(url.pathname);
            if (previous) return previous;
          }
        }
        try {
          const response = await network(event.request);
          if (
            response.ok &&
            !(
              url.pathname.endsWith('.js') &&
              response.headers.get('content-type')?.includes('text/html')
            )
          ) {
            await cache.put(url.pathname, response.clone());
            return response;
          }
        } catch {
          /* Missing assets must fail explicitly, never fall back to HTML. */
        }
        return new Response('Recurso no disponible. Recarga con conexión.', { status: 503 });
      })(),
    );
  }
});
