const CACHE = "emyce-shell-v3";
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/favicon.svg", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  if (
    u.pathname.startsWith("/_next/static/") ||
    u.pathname.startsWith("/icons/")
  )
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const response = await fetch(e.request);
        if (response.ok) await cache.put(e.request, response.clone());
        return response;
      })(),
    );
});
