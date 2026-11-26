const cachePrefix = "kaipai-";
const cacheName = `${cachePrefix}v16`;
const shell = [
  "./index.html", "./style.css?v=16", "./app.js?v=16", "./cards-cn.json?v=3",
  "./fonts/kaipai-serif.woff", "./moonlake.jpg",
  "./manifest.webmanifest", "./icons/kaipai-32.png", "./icons/kaipai-192.png", "./icons/kaipai-512.png", "./icons/kaipai-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    let loaded = 0;
    await Promise.all(shell.map(async path => {
      const request = new Request(new URL(path, self.registration.scope), {cache: "no-cache"});
      if (!(await cache.match(request))) await cache.add(request);
      loaded++;
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          client.postMessage({type: "launch-progress", loaded, total: shell.length});
        }
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => (
      name.startsWith(cachePrefix) && name !== cacheName
    )).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (request.mode === "navigate") {
      return (await cache.match("./index.html")) ?? fetch(request);
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    return fetch(request);
  })());
});
