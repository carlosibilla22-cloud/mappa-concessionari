const CACHE_NAME = "concessionari-ninja";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();

    // avvisa le pagine che c'è un SW attivo
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: "SW_ACTIVE" });
  })());
});

// network-first (sempre l'ultima versione, fallback offline)
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

// stale-while-revalidate per asset (veloce + si aggiorna da solo)
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

  // NON cachiamo le tile OSM (troppo pesanti)
  if (url.hostname.includes("tile.openstreetmap.org")) return;

  // Navigazione: prendi sempre l'ultima index.html
  if (req.mode === "navigate") {
    event.respondWith(networkFirst("./index.html"));
    return;
  }

  // Anche se qualcuno chiede index.html direttamente:
  if (url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Il resto: veloce e si aggiorna in background
  if (req.method === "GET") {
    event.respondWith(staleWhileRevalidate(req));
  }
});