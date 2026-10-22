/* =========================================================
   Skuddkart – service worker (gjør at appen virker uten nett)

   Strategi «nett først»: Når det er nett, hentes alltid nyeste
   versjon (og en kopi lagres). Uten nett brukes den lagrede kopien.
   Dataene (spillere, kamper) ligger ikke her, men i nettleserens
   lagring, og berøres ikke av denne filen.
   ========================================================= */

const CACHE = 'skuddkart-v1';

// Filene appen trenger for å starte uten nett
const APP_FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'icon.svg',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Rydd bort gamle kopier hvis CACHE-navnet endres
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Åpnes appen uten nett, vises startsiden
        if (request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      })
  );
});
