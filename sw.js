const CACHE = "anleggsservice-v43";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Ikke rør kryss-domene-trafikk (Firebase, Google-innlogging osv.)
  if(url.origin !== location.origin) return;
  if(e.request.method !== "GET") return;
  const isAppShell = e.request.mode === "navigate" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if(isAppShell){
    // Nett først for selve appen: henter nyeste når du har dekning,
    // faller tilbake til cache når du er offline.
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
  } else {
    // Cache først for ikoner/manifest (endres sjelden).
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
