const CACHE_NAME = 'particle-fountain-v1';
const urlsToCache = [
  './index.html',
  './styles.css',
  './main.js',
  './renderer.js',
  './worker.js',
  './ui-wiring.js',
  './visualizations.js',
  './manifest.json',
  '../shared/ui.js',
  '../shared/utils.js',
  '../shared/styles-extra.css'
];

// TODO: Disable or bypass caching in dev mode if needed.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
