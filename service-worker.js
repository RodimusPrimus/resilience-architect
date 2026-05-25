/**
 * Service Worker for Resilience Architect: AWS DR Strategy Mapper
 * Implements cache-first strategy with versioned cache for full offline support.
 */

const CACHE_NAME = 'resilience-architect-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/wizard.js',
  './js/mapping-engine.js',
  './js/dashboard.js',
  './js/sanitizer.js',
  './js/i18n.js',
  './js/theme.js',
  './js/pdf-export.js',
  './js/session-guard.js',
  './js/sw-register.js',
  './i18n/en.json',
  './i18n/es.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/**
 * Install event: pre-cache all application assets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

/**
 * Activate event: clean up old caches that don't match the current version.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event: cache-first strategy.
 * Serve from cache if available, otherwise fetch from network.
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
  );
});
