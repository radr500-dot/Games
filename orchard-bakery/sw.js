// Offline support: keep a copy of the app so it opens with no signal.
// Only this game's old caches are cleared; other games and My Games share the same site storage.
const CACHE = 'orchard-bakery-v10';
const FILES = [
  './', './index.html', './style.css', './app.js', './art.js', './models.js', './world.js', './farm.js',
  './vendor/three.module.min.js', './vendor/BufferGeometryUtils.js', './vendor/RoomEnvironment.js', './fonts/fredoka.woff2', './fonts/nunito.woff2',
  './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('orchard-bakery-') && k !== CACHE).map((k) => caches.delete(k))))
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
  // Network first (so updates arrive), falling back to the cached copy offline.
  e.respondWith(
    fresh(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
