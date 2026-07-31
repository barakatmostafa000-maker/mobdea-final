const scriptUrl = new URL(self.location.href);
const releaseVersion = scriptUrl.searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'mobdea-shell-';
const CACHE_VERSION = `${CACHE_PREFIX}${releaseVersion}`;
const scopeUrl = new URL(self.registration.scope);
const indexUrl = new URL('index.html', scopeUrl).toString();
const shellUrl = scopeUrl.toString();

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll([shellUrl, indexUrl]).catch(() => null)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(indexUrl, response.clone()));
          return response;
        })
        .catch(() => caches.match(indexUrl).then((cached) => cached || Response.error()))
    );
    return;
  }

  // JavaScript and CSS must be network-first. Serving an old chunk beside a
  // new index.html is a common cause of the tablet white screen after updates.
  if (['script', 'style', 'worker'].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && ['image', 'font'].includes(request.destination)) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      });
      return cached || network;
    })
  );
});
