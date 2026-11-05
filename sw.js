// Offline support for the My Games home screen. Each game has its own service
// worker in its folder, which takes over inside that folder.
const CACHE = 'my-games-v3';
const FILES = [
  './', './index.html', './hub.css', './hub.js', './games.json', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('my-games-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Always check with the server (a quick "has it changed?") instead of trusting the
// phone's own web cache, which can keep an old copy for minutes after an update.
function fresh(req) {
  if (new URL(req.url).origin !== self.location.origin) return fetch(req);
  return fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Network first so new games appear right away; cached copy when offline.
  e.respondWith(
    fresh(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
