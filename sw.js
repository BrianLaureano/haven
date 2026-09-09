/* Haven — service worker (PWA: instala + funciona offline).
   Shell mínimo no precache; o resto é cacheado em runtime.
   HTML = network-first (pega updates); estáticos = cache-first
   (assets são versionados com ?v=N, então URL nova = conteúdo novo).
   Só intercepta a MESMA origem — Firebase/TMDB/IGDB/fontes vão direto pra rede. */
const CACHE = 'haven-shell-v24';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icon-192.png', 'assets/scenes/dawn.webp'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // não mexe em chamadas externas

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML){
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r;
    }))
  );
});
