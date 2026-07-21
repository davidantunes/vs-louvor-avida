/* Service Worker — Biblioteca de Louvor Igreja Amor e Vida
   v131.14 — Áudio network-first; limpa cache de áudio antigo na ativação.
   Código-fonte (app.js/css/html/config) network-first: correções chegam na hora.
   O banner de atualização avisa quando há nova versão disponível. */

const SW_VERSION = 'v131.41.0';
const SHELL_CACHE = `vsl-shell-${SW_VERSION}`;
const ASSET_CACHE = `vsl-assets-${SW_VERSION}`;
const AUDIO_CACHE = `vsl-audios-${SW_VERSION}`;
const API_CACHE   = `vsl-api-${SW_VERSION}`;

// Shell: abre do cache imediatamente (instantâneo), atualiza em background.
// Quando houver versão nova o SW envia mensagem SW_UPDATED para o app mostrar
// o banner "Nova versão disponível — Atualizar agora".
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo-avida.jpg'
];

const AUDIO_CACHE_MAX_ENTRIES = 300;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, API_CACHE]);
  // V131.14 — NÃO mantém AUDIO_CACHE: força limpeza do cache de áudio antigo,
  // que pode conter respostas de erro gravadas quando a chave do Drive estava
  // incorreta. O áudio será rebaixado do servidor (agora funcionando).
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach(c =>
        c.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
      ))
  );
});

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

  // ÁUDIOS — cache first (essencial para uso offline)
  if (isAudioRequest(req, url)) {
    event.respondWith(audioCacheFirst(req));
    return;
  }

  // API — network first (dados sempre frescos), fallback ao cache
  if (sameOrigin && url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/transpose/')) return;
    // V131.25 — Requisições de ÁUDIO com Range (seek) chegam aqui porque
    // isAudioRequest as ignora de propósito. Deixa o navegador falar direto
    // com o servidor, sem o SW no meio — streaming e seek limpos.
    if (url.pathname.startsWith('/api/audio/') || url.pathname.startsWith('/api/aw-audio/')) return;
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // V131.4 — Código-fonte (app.js, styles.css, index.html, config.js):
  // NETWORK-FIRST. Garante que correções cheguem imediatamente ao usuário,
  // sem precisar abrir o app duas vezes. Cai no cache só se a rede falhar
  // (mantém funcionamento offline). Isso resolve o problema de o app rodar
  // uma versão antiga do código após um deploy.
  if (sameOrigin && (
      url.pathname === '/' ||
      url.pathname === '/index.html' ||
      url.pathname === '/app.js' ||
      url.pathname === '/audio-mapa.js' ||
      url.pathname === '/styles.css' ||
      url.pathname === '/config.js'
  )) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // Demais assets (imagens, fontes, manifest) — stale-while-revalidate
  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }
});

function isAudioRequest(req, url) {
  if (req.headers.has('range')) return false;
  if (req.destination === 'audio') return true;
  if (url.pathname.startsWith('/api/audio/')) return true;
  if (/\.(mp3|m4a|ogg|opus|wav|aac)(\?|$)/i.test(url.pathname)) return true;
  return false;
}

async function audioCacheFirst(req) {
  // V131.14 — Mudado para NETWORK-FIRST. Antes era cache-first, o que servia
  // respostas de erro antigas (gravadas quando a chave do Drive estava errada).
  // Agora busca sempre do servidor; usa cache só se a rede falhar (offline).
  const cache = await caches.open(AUDIO_CACHE);
  try {
    const resp = await fetch(req);
    // Só cacheia respostas completas e boas (200). Nunca cacheia erro/parcial.
    if (resp && resp.ok && resp.status === 200) {
      cache.put(req, resp.clone())
        .then(() => trimCache(AUDIO_CACHE, AUDIO_CACHE_MAX_ENTRIES))
        .catch(() => {});
    }
    return resp;
  } catch (err) {
    // Rede falhou — tenta o cache (modo offline)
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    // V131.28 — cache:'no-cache' força a revalidação com o SERVIDOR, furando o
    // cache HTTP do navegador. Sem isso, o fetch() era atendido pelo cache de
    // disco (max-age antigo) e entregava código velho achando que era da rede.
    const resp = await fetch(req, { cache: 'no-cache' });
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
