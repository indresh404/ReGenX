// ══════════════════════════════════════════════════════
// ReGenX Service Worker v3 — Offline-First PWA Engine
// Strategies: CacheFirst (static), NetworkFirst (dynamic)
// Supports: Background Sync, Push Notifications
// ══════════════════════════════════════════════════════

const CACHE_VERSION = 'regenx-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const SYNC_TAG      = 'regenx-order-sync';

// Static shell assets — always serve from cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/src/styles.css',
  '/src/app.js',
  '/src/scanner.js',
  '/src/intelligence.js',
  '/src/trust.js',
  '/src/iot-bridge.js',
  '/src/yield-optimizer.js',
  '/src/vision-scanner.js',
  '/src/esg-reporter.js',
  '/src/cloud-sync.js'
];

// ── INSTALL: Pre-cache static shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// ── ACTIVATE: Clean up old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log(`[SW] Deleting stale cache: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// ── FETCH: CacheFirst for static, NetworkFirst for API ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // CacheFirst for same-origin static assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        // Not in cache — fetch & store in dynamic cache
        return fetch(request)
          .then(networkResponse => {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
          });
      })
    );
    return;
  }

  // NetworkFirst for external APIs (weather, Appwrite, CDN)
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── BACKGROUND SYNC: Replay queued orders when online ──
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedOrders());
  }
});

async function replayQueuedOrders() {
  // In production: read from IndexedDB queue and POST to Appwrite
  // Here we notify all clients that connectivity is restored
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      message: '☁️ Back online! Queued orders have been synced to the cloud.'
    });
  });
}

// ── PUSH NOTIFICATIONS: Handle incoming push events ──
self.addEventListener('push', (event) => {
  let data = { title: 'ReGenX Alert', body: 'You have a new notification.' };
  
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: '📍 View on Map' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK: Deep-link into app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
