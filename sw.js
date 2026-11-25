const cachePrefix = "kaipai-";
const cacheName = `${cachePrefix}v13`;
const shell = [
  "./", "./index.html", "./style.css?v=13", "./app.js?v=13", "./cards-cn.json?v=3",
  "./fonts/kaipai-serif.woff", "./moonlake.jpg",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => (
    cache.addAll(shell.map((url) => new Request(url, { cache: "reload" })))
  )));
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
      try {
        return await fetch(request);
      } catch {
        return (await cache.match("./index.html")) ?? Response.error();
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const imageFolder = new URL("./img/", self.registration.scope);
    if (response.ok && request.destination === "image" && request.url.startsWith(imageFolder.href)) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
