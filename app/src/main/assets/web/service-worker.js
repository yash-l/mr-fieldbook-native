const CACHE = 'mr-one-shell-v196-route-card';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './planner.js',
  './records.js',
  './admin.js',
  './admin-cloud.js',
  './seed-data.js',
  './cloud/config.js',
  './cloud/supabase-client.js',
  './cloud/auth.js',
  './cloud/conflict.js',
  './cloud/sync.js',
  './cloud/migrations.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const NETWORK_FIRST_PATHS = new Set([
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/planner.js',
  '/records.js',
  '/admin.js',
  '/admin-cloud.js',
  '/seed-data.js',
  '/cloud/config.js',
  '/cloud/supabase-client.js',
  '/cloud/auth.js',
  '/cloud/conflict.js',
  '/cloud/sync.js',
  '/cloud/migrations.js'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(
      PRECACHE.map(async asset => {
        const request = new Request(asset, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      })
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (response && response.ok && response.type !== 'opaque') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const useNetworkFirst = isNavigation || NETWORK_FIRST_PATHS.has(url.pathname);

  event.respondWith(useNetworkFirst ? networkFirst(request) : cacheFirst(request));
});
