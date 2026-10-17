/* =====================================================================
   Gr8r Studio — Progressive Web App Service Worker
   - Precaches the application shell and static assets for instant offline boot.
   - Network-first strategy for navigation requests with fallback to precached app shell.
   - Stale-while-revalidate / cache-first strategy for immutable hashed assets.
   - Explicit exclusion of user data, backups, attachment streams, and external APIs.
   - Self-updating with SKIP_WAITING message support.
   ===================================================================== */

const CACHE_NAME = 'gr8r-shell-v1';

// Base application shell assets required for offline launch
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle GET requests; never intercept or cache mutations/writes
  if (request.method !== 'GET') {
    return;
  }

  // 2. Explicitly bypass user data, file attachments, and Cal.com/external APIs
  // Never cache or store user database contents, backups, or attachment blobs
  if (
    url.pathname.includes('/attachments/') ||
    url.pathname.includes('/backups/') ||
    url.pathname.includes('/snapshots/') ||
    url.pathname.endsWith('gr8r-data.json') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('cal.com') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('googleapis') ||
    url.protocol.startsWith('blob:') ||
    url.protocol.startsWith('data:')
  ) {
    return;
  }

  // 3. For navigation requests (HTML pages), use Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallbackShell = await caches.match('./index.html') || await caches.match('./');
          return fallbackShell || Response.error();
        })
    );
    return;
  }

  // 4. For same-origin static assets (/assets/*, fonts, images), use Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. For third-party assets like Google Fonts CSS/WebFonts, use Cache-First with network fallback
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
  }
});

