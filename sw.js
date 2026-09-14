// Network-first service worker: always fresh when online, still works offline.
const CACHE = 'tables-rocket-v1';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/store.js', './js/mtc.js', './js/adaptive.js', './js/session.js', './js/rewards.js', './js/audio.js', './js/util.js',
  './js/views/profiles.js', './js/views/home.js', './js/views/check.js', './js/views/practice.js', './js/views/results.js', './js/views/progress.js', './js/views/grownups.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
