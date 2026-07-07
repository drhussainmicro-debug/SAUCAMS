/* SAUC Antimicrobial Guide — service worker (offline + tap-to-update). */
var CACHE = 'sauc-amx-v14';
var ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return c.add(u).catch(function () {}); }));
  }));   /* NOTE: no skipWaiting() — the new version waits until the user taps "Update". */
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (cached) {
    if (cached) return cached;
    return fetch(e.request).then(function (resp) {
      try { var u = new URL(e.request.url); if (u.origin === location.origin) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); } } catch (err) {}
      return resp;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
