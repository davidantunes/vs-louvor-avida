// VS Louvor — Service Worker
// Estratégia:
//   - App shell (HTML, CSS, JS, logo): cache-first com revalidação em background
//   - Áudio /api/audio e /api/transpose: cache-first quando o item já foi tocado
//                                        (limite de 50 itens, LRU simples)
//   - Tudo o resto: network-first com fallback para cache

const VERSION = 'v2.15.0';
const SHELL_CACHE = `vs-shell-${VERSION}`;
const AUDIO_CACHE = `vs-audio-${VERSION}`;
const RUNTIME_CACHE = `vs-runtime-${VERSION}`;
const AUDIO_CACHE_MAX_ENTRIES = 50;

const SHELL_FILES = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'config.js',
  'manifest.json',
  'assets/logo-avida.jpg',
  'assets/hero-blue-cross.png',
  'assets/hero-warm-cross.png',
  'assets/hero-worship.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES).catch(err => console.warn('SW: shell falhou parcialmente', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      const valid = new Set([SHELL_CACHE, AUDIO_CACHE, RUNTIME_CACHE]);
      return Promise.all(keys.map(k => valid.has(k) ? null : caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Limpeza LRU do cache de áudio
async function trimAudioCache() {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const requests = await cache.keys();
    if (requests.length <= AUDIO_CACHE_MAX_ENTRIES) return;
    const overflow = requests.length - AUDIO_CACHE_MAX_ENTRIES;
    for (let i = 0; i < overflow; i++) {
      await cache.delete(requests[i]);
    }
  } catch {}
}

function isAudioRequest(url) {
  return url.pathname.startsWith('/api/audio/') || url.pathname.startsWith('/api/transpose/');
}

function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return /\.(js|css|html|svg|png|jpg|jpeg|webp|ico)$/i.test(url.pathname)
    || url.pathname === '/' || url.pathname === '/index.html'
    || url.pathname === '/manifest.json';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não interceptar Range requests parciais — deixar o browser/server lidarem direto
  if (req.headers.get('range')) return;

  // Não cachear chamadas de API que não sejam áudio
  if (url.pathname.startsWith('/api/') && !isAudioRequest(url)) {
    return; // network direto
  }

  // Cross-origin (Appwrite, Drive thumbnails, CDN do appwrite-js): network direto
  if (url.origin !== self.location.origin) return;

  // Áudio: cache-first com fallback de rede e armazenamento da resposta
  if (isAudioRequest(url)) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(AUDIO_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const response = await fetch(req);
        if (response && response.ok && response.status === 200) {
          cache.put(req, response.clone()).then(trimAudioCache).catch(() => {});
        }
        return response;
      } catch (err) {
        const cache = await caches.open(AUDIO_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        return new Response('Áudio indisponível offline.', { status: 503 });
      }
    })());
    return;
  }

  // App shell: stale-while-revalidate
  if (isShellAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then(response => {
        if (response && response.ok) cache.put(req, response.clone()).catch(() => {});
        return response;
      }).catch(() => null);
      return cached || (await networkPromise) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Padrão: network-first com fallback ao cache
  event.respondWith((async () => {
    try {
      const response = await fetch(req);
      if (response && response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      return cached || new Response('Offline', { status: 503 });
    }
  })());
});

// Mensagens — permite app pedir limpeza do cache
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_AUDIO_CACHE') {
    caches.delete(AUDIO_CACHE).then(() => event.ports[0]?.postMessage({ ok: true }));
  }
});
