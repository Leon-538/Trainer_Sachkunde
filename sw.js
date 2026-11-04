/* Service Worker: macht den Trainer nach dem ersten Aufruf offline nutzbar.
   Nach Änderungen an Dateien die Versionsnummer erhöhen, damit Geräte die neue Fassung laden. */
const CACHE = 'sachkunde-trainer-v1';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/questions.js',
  'img/A2.png',
  'img/A3.png',
  'img/A4.png',
  'img/A6.png',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Erst Netz (damit Updates sofort ankommen), bei Funkloch aus dem Cache. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
