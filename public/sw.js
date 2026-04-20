const CACHE_NAME = 'enguistudio-shell-v2';
const APP_SHELL = [
  '/',
  '/m/create',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

const shouldCacheResponse = (request, response) => {
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return false;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/generations/')) return false;
  if (url.pathname.startsWith('/results/')) return false;

  return true;
};

const putInCache = async (request, response) => {
  if (!shouldCacheResponse(request, response)) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone()).catch(() => undefined);
  return response;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/generations/')) return;
  if (url.pathname.startsWith('/results/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(async () => (await caches.match(request)) || caches.match('/m/create') || caches.match('/'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => putInCache(request, response))
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error(`Network request failed for ${url.pathname}`);
      })
  );
});
