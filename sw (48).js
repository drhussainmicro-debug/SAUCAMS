/* Sabah Al Ahmad Urology Centre — Antimicrobial Guide
   Service worker.

   Contract with index.html (do not change without changing the page):
     - the page posts the string "SKIP_WAITING" to the waiting worker
     - the page reloads itself on 'controllerchange'
   So this worker must NOT call skipWaiting() on its own: the app shows an
   "update ready" prompt first, and the user decides when to take it.

   Strategy:
     - navigations  -> network first, fall back to the cached shell (offline)
     - static files -> cache first, refreshed in the background
   Bump CACHE on every deploy so old assets are dropped.
*/

const CACHE = 'sauc-ams-v1';

const SHELL = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll fails the whole install if any single item 404s, so add
      // individually and tolerate misses.
      .then(cache => Promise.all(
        SHELL.map(url => cache.add(url).catch(() => null))
      ))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: always try the network so a new build is picked up, but
  // fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Google Fonts: cache once, then serve from cache.
  if (!sameOrigin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
