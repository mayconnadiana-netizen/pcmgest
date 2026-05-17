const CACHE = 'pcmgest-v1';
const ASSETS = [
  '/pcmgest/',
  '/pcmgest/index.html',
  '/pcmgest/manifest.json',
  '/pcmgest/icon-192.png',
  '/pcmgest/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Instala e faz cache dos arquivos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve do cache quando offline, atualiza quando online
self.addEventListener('fetch', e => {
  // Não intercepta chamadas Firebase/API
  if(e.request.url.includes('firestore.googleapis.com') ||
     e.request.url.includes('firebase') ||
     e.request.url.includes('anthropic')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if(res.ok && e.request.method === 'GET'){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
