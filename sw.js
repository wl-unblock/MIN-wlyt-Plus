// MIN-Tube-Pro Service Worker
const CACHE_NAME = 'min-wlyt-plus-v2';
const PRECACHE = [
  '/youtube-pro',
  '/manifest.json',
  '/min-img.png',
  '/classroom.192',
  '/classroom.512',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => (key === 'min-wlyt-plus' || key.startsWith('min-wlyt-plus-')) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep the existing cache-first behavior for the site's pages and assets,
  // including proxy frontends, while using only this app's own cache.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await cache.match('/youtube-pro');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
