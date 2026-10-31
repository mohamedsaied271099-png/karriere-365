// يخلي التطبيق يفتح من غير إنترنت (Claude بس هو اللي محتاج نت)
const CACHE = "karriere365-v2";
const FILES = ["./", "./index.html", "./styles.css", "./app.js", "./catalog.js", "./ai.js", "./files.js", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // طلبات الـ API والـ CDN تعدي عادي
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
