/* Service Worker — Biblioteca de Louvor Igreja Amor e Vida
   v96 — performance pack (gzip, webp, preconnect, /api/library cache) */

const SW_VERSION = 'v125.0.0';
const SHELL_CACHE = `vsl-shell-${SW_VERSION}`;
const ASSET_CACHE = `vsl-assets-${SW_VERSION}`;
const AUDIO_CACHE = `vsl-audios-${SW_VERSION}`;
const API_CACHE = `vsl-api-${SW_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.json',
  '/assets/logo-avida.jpg'
];

// Limite do cache de áudios: ~300 músicas. LRU simples (ordem de inserção).
const AUDIO_CACHE_MAX_ENTRIES = 300;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, AUDIO_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Permite que o app peça pré-cache de áudios em background
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PRECACHE_AUDIOS' && Array.isArray(data.urls)) {
    event.waitUntil(precacheAudios(data.urls));
  }
  if (data.type === 'CLEAR_AUDIO_CACHE') {
    event.waitUntil(caches.delete(AUDIO_CACHE));
  }
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // ÁUDIOS — cache first. Backend: /api/audio/:id  e direto do Drive (cross-origin).
  if (isAudioRequest(req, url)) {
    event.respondWith(audioCacheFirst(req));
    return;
  }

  // API leve (Appwrite, config) — network first com fallback ao cache
  if (sameOrigin && url.pathname.startsWith('/api/')) {
    // Evita cachear /api/transpose (pesado e variável)
    if (url.pathname.startsWith('/api/transpose/')) return;
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Listagem Drive — network first com cache curto para indexação rápida no 2º acesso
  if (sameOrigin && url.pathname.startsWith('/api/drive')) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Assets estáticos do mesmo domínio (CSS/JS/imagens) — stale-while-revalidate
  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }

  // Demais cross-origin: deixa o browser cuidar.
});

function isAudioRequest(req, url) {
  // Range requests não devem ser cacheadas (servem fatias parciais)
  if (req.headers.has('range')) return false;
  if (req.destination === 'audio') return true;
  if (url.pathname.startsWith('/api/audio/')) return true;
  if (/\.(mp3|m4a|ogg|opus|wav|aac)(\?|$)/i.test(url.pathname)) return true;
  // Cross-origin Drive (download direto): cobre googleusercontent / drive.google.com com mime de áudio
  return false;
}

async function audioCacheFirst(req) {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    const resp = await fetch(req);
    if (resp && resp.ok && resp.status === 200) {
      cache.put(req, resp.clone()).then(() => trimCache(AUDIO_CACHE, AUDIO_CACHE_MAX_ENTRIES)).catch(() => {});
    }
    return resp;
  } catch (err) {
    const cache = await caches.open(AUDIO_CACHE);
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
      return resp;
    })
    .catch(() => hit);
  return hit || fetchPromise;
}

async function precacheAudios(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  let added = 0;
  for (const u of urls) {
    try {
      const already = await cache.match(u, { ignoreVary: true });
      if (already) continue;
      const resp = await fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => null);
      if (resp && resp.ok && resp.status === 200) {
        await cache.put(u, resp.clone()).catch(() => {});
        added++;
      }
    } catch (_) {}
  }
  await trimCache(AUDIO_CACHE, AUDIO_CACHE_MAX_ENTRIES).catch(() => {});
  return added;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.length - maxEntries;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]).catch(() => {});
  }
}
