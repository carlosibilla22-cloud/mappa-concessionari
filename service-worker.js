const CACHE_NAME = "concessionari-ninja";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((fresh) => {
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.hostname.includes("tile.openstreetmap.org")) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst("./index.html"));
    return;
  }

  if (url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (req.method === "GET") {
    event.respondWith(staleWhileRevalidate(req));
  }
});
