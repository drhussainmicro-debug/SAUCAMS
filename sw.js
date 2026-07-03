// SAUC Antimicrobial Guide — service worker
// NOTE: deliberately does NOT include "./" in the cached file list — on some
// static hosts (e.g. GitHub Pages) that path resolves via a redirect and can
// silently fail the entire install step, blocking Chrome from ever
// recognizing the site as installable even though the manifest is fine.
// Each file is fetched and cached individually instead, so one bad file
// can't block the rest.

const CACHE_NAME = 'sauc-guide-v1';
const FILES_TO_CACHE = [
  'index.html',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        FILES_TO_CACHE.map(file =>
          fetch(file)
            .then(res => { if (res.ok) return cache.put(file, res); })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
