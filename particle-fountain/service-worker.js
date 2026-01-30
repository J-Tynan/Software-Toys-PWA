// Minimal service worker stub — TODO: refine cache strategies for production
const CACHE_NAME = 'particle-fountain-cache-v1';
const urlsToCache = ['/', '/index.html', '/styles.css', '/main.js'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (ev) => {
  // Network-first with cache fallback
  ev.respondWith(fetch(ev.request).catch(() => caches.match(ev.request)));
});

// DEV note: disable SW during development to avoid stale files.
