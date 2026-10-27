// Testversjonen (/test/) har egen cache, så den ekte appen og testen ikke rører hverandre
const IS_TEST = self.registration.scope.includes("/test/");
const CACHE = "anleggsservice-v90" +(IS_TEST ? "-test" : "");
const PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";            // PDF-visning av kataloger
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const LIBS = [PDFLIB, PDFJS, PDFJS_WORKER];
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", ...LIBS];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k.endsWith("-test") === IS_TEST).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // jsPDF og PDF.js fra CDN: cache først, så de virker offline
  if(LIBS.includes(e.request.url)){
    const url = e.request.url;
    e.respondWith(caches.match(url).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(url, copy));
      return res;
    })));
    return;
  }
  // Ikke rør annen kryss-domene-trafikk (Firebase, Google-innlogging osv.)
  if(url.origin !== location.origin) return;
  // Den ekte appen skal ikke håndtere testversjonen
  if(!IS_TEST && url.pathname.includes("/test/")) return;
  if(e.request.method !== "GET") return;
  const isAppShell = e.request.mode === "navigate" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if(isAppShell){
    // Nett først for selve appen: henter nyeste når du har dekning.
    // Offline, eller nettet bruker over 3 sek (dårlig dekning): bruk lagret versjon.
    // Nedlastingen fortsetter i bakgrunnen og oppdaterer cachen til neste gang.
    const cached = () => caches.match("./index.html");
    const net = fetch(e.request);
    const update = net.then(res => {
      if(!res.ok) return;
      const copy = res.clone();
      return caches.open(CACHE).then(c => c.put("./index.html", copy));
    }).catch(() => {});
    const slow = new Promise(r => setTimeout(r, 3000)).then(cached);
    e.respondWith(Promise.race([
      net.catch(cached),
      slow.then(r => r || net)       // ingen lagret versjon ennå → vent på nettet
    ]));
    e.waitUntil(update);
  } else {
    // Cache først for ikoner/manifest (endres sjelden).
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
