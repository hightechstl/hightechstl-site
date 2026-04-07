self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    await self.registration.unregister();
    await self.clients.claim();

    const clients = await self.clients.matchAll({type: 'window'});
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});
