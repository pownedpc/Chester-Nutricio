// Service worker mínim: cachea l'aplicació (no les crides a la IA) com a
// còpia de seguretat offline, però SEMPRE prioritza la xarxa perquè els
// canvis que es publiquin es vegin a l'instant. La versió anterior servia
// primer la caché si existia, cosa que deixava l'app "congelada" en la
// primera versió instal·lada — per això es bumpeja el nom de la caché aquí,
// perquè els navegadors amb la versió vella la descartin en actualitzar-se.
const CACHE = 'chester-nutricio-v2';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Mai cachejar crides al Worker d'IA (dades sempre fresques, i cross-origin).
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network-first: sempre intenta la xarxa (versió fresca) i només cau a la
  // caché si no hi ha connexió. Així cap redisseny futur es queda "atrapat".
  e.respondWith(
    fetch(e.request).then(res => {
      // Clonar ARA, de forma síncrona — si s'espera a dins del .then() de
      // caches.open(), el body de "res" ja pot haver-se consumit quan la
      // pàgina el llegeix, i clone() peta amb "body is already used".
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
