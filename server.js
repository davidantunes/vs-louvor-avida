const express = require('express');
const compression = require('compression');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// V96 — Compressão gzip/brotli automática para HTML, CSS, JS, JSON.
// Reduz ~80% do tráfego de texto. Não comprime áudio (já comprimido).
app.use(compression({
  // threshold padrão é 1KB; reduzimos um pouco para pegar mais arquivos pequenos
  threshold: 512,
  // Não comprime se o cliente pediu explicitamente para não comprimir
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Em produção, prefira definir GOOGLE_DRIVE_API_KEY nas variáveis de ambiente.
// A chave abaixo está como fallback porque o projeto já foi configurado para você.
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';
const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';

app.use(express.json({ limit: '2mb' }));

// O Service Worker e o Manifest precisam ser servidos sem cache forte
// para que atualizações cheguem rápido aos celulares.
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// V131.6 — Rota /config.js dinâmica ANTES do express.static.
// Injeta a chave do Drive e config do Appwrite no cliente imediatamente,
// garantindo que cfg.DRIVE_API_KEY esteja disponível antes de qualquer play.
// Lê direto de process.env (sempre disponível) para não depender da ordem
// de declaração das constantes abaixo.
app.get('/config.js', (req, res) => {
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY || '';
  res.type('application/javascript').setHeader('Cache-Control', 'no-store');
  res.send(`window.VS_LOUVOR_CONFIG = {
  APP_TITLE: "Biblioteca de Louvor — Igreja Amor e Vida",
  ROOT_FOLDER_ID: ${JSON.stringify(process.env.ROOT_FOLDER_ID || '1Tcua5y0O9Bv5LRNmtIYnDCderiaN8xB8')},
  API_KEY: ${JSON.stringify(driveKey)},
  DRIVE_API_KEY: ${JSON.stringify(driveKey)},
  USE_BACKEND: true,
  APPWRITE_ENDPOINT: ${JSON.stringify(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')},
  APPWRITE_PROJECT_ID: ${JSON.stringify(process.env.APPWRITE_PROJECT_ID || '69f4cb460024e484358b')},
  APPWRITE_DATABASE_ID: ${JSON.stringify(process.env.APPWRITE_DATABASE_ID || 'louvor_avida')}
};`);
});

app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Imagens/fontes: 7 dias (mudam raramente)
    if (/\.(png|jpg|jpeg|webp|svg|gif|woff2?|ttf|eot)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    // JS/CSS: 1h com stale-while-revalidate de 24h.
    // O SW já controla o cache no cliente; esse header é para o CDN do Cloudflare.
    // V127.2: aumentado de 5min para 1h — com Render Starter não há cold start,
    // e o banner SW_UPDATED avisa o usuário quando há nova versão.
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    }
  }
}));


// Appwrite backend integration (V28B)
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'louvor_avida';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || '';
const APPWRITE_APP_STATE_COLLECTION_ID = process.env.APPWRITE_APP_STATE_COLLECTION_ID || 'app_state';
const APPWRITE_USER_STATE_COLLECTION_ID = process.env.APPWRITE_USER_STATE_COLLECTION_ID || 'user_state';
// V116 — Admins configurados via variável de ambiente no Render.
// APPWRITE_ADMIN_EMAILS = "david.o.antunes@gmail.com,outro@email.com"
// Fallback: se a variável não estiver configurada, usa o e-mail do criador do sistema.
const ADMIN_FALLBACK = ['david.o.antunes@gmail.com'];
const APPWRITE_ADMIN_EMAILS_RAW = (process.env.APPWRITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const APPWRITE_ADMIN_EMAILS = APPWRITE_ADMIN_EMAILS_RAW.length
  ? APPWRITE_ADMIN_EMAILS_RAW
  : ADMIN_FALLBACK;

function appwriteReady() {
  return Boolean(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_DATABASE_ID && APPWRITE_API_KEY);
}
function appwriteHeaders() {
  return {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': APPWRITE_API_KEY,
    'Content-Type': 'application/json'
  };
}
async function appwriteRequest(method, path, body) {
  if (!appwriteReady()) throw new Error('Appwrite não configurado no Render.');
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    method,
    headers: appwriteHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : text;
    throw new Error(`Appwrite ${response.status}: ${message}`);
  }
  return data;
}
async function listDocuments(collectionId) {
  const data = await appwriteRequest('GET', `/databases/${encodeURIComponent(APPWRITE_DATABASE_ID)}/collections/${encodeURIComponent(collectionId)}/documents?limit=500`);
  return data.documents || [];
}
async function upsertState(collectionId, matcher, data) {
  const docs = await listDocuments(collectionId);
  const found = docs.find(matcher);
  if (found) {
    return appwriteRequest('PATCH', `/databases/${encodeURIComponent(APPWRITE_DATABASE_ID)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(found.$id)}`, { data });
  }
  return appwriteRequest('POST', `/databases/${encodeURIComponent(APPWRITE_DATABASE_ID)}/collections/${encodeURIComponent(collectionId)}/documents`, { documentId: 'unique()', data });
}
app.get('/api/appwrite/config', (req, res) => {
  res.json({ endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID, databaseId: APPWRITE_DATABASE_ID, ready: appwriteReady(), adminEmails: APPWRITE_ADMIN_EMAILS, adminConfigured: true, driveApiKey: API_KEY });
});

app.get('/api/appwrite/bootstrap/:userId', async (req, res) => {
  try {
    const [appDocs, userDocs] = await Promise.all([
      listDocuments(APPWRITE_APP_STATE_COLLECTION_ID),
      listDocuments(APPWRITE_USER_STATE_COLLECTION_ID)
    ]);
    const findApp = key => {
      const doc = appDocs.find(d => d.key === key);
      return doc?.value ? JSON.parse(doc.value) : null;
    };
    const findUser = key => {
      const doc = userDocs.find(d => d.user_id === req.params.userId && d.key === key);
      return doc?.value ? JSON.parse(doc.value) : null;
    };
    res.json({
      setlists: findApp('setlists'),
      members: findApp('members'),
      monthlySchedule: findApp('monthlySchedule'),
      usageHistory: findApp('usageHistory'),
      favorites: findUser('favorites')
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

async function verifyAppwriteJWT(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('JWT do Appwrite não informado.');
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) throw new Error('Appwrite Auth não configurado.');
  const response = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers: {
      'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      'X-Appwrite-JWT': token
    }
  });
  const text = await response.text();
  let user = null;
  try { user = text ? JSON.parse(text) : null; } catch { user = null; }
  if (!response.ok) {
    const message = user?.message || text || 'Não foi possível validar usuário Appwrite.';
    throw new Error(message);
  }
  return user;
}
async function requireAdminUser(req, res) {
  try {
    const user = await verifyAppwriteJWT(req);
    const email = String(user?.email || '').toLowerCase();
    if (!APPWRITE_ADMIN_EMAILS.length) {
      res.status(403).json({ error: 'Nenhum administrador configurado. Defina APPWRITE_ADMIN_EMAILS no Render.' });
      return null;
    }
    if (!APPWRITE_ADMIN_EMAILS.includes(email)) {
      res.status(403).json({ error: 'Usuário sem permissão para editar a escala.' });
      return null;
    }
    return user;
  } catch (error) {
    res.status(401).json({ error: error.message });
    return null;
  }
}
app.put('/api/appwrite/admin/state/:key', async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_APP_STATE_COLLECTION_ID, d => d.key === req.params.key, {
      key: req.params.key,
      value: JSON.stringify(req.body.value ?? null),
      updated_at: updatedAt
    });
    res.json({ ok: true, id: doc.$id, updatedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// V127.2 — Cache em memória para leituras do Appwrite state.
// Evita múltiplas chamadas simultâneas para o mesmo dado (ex: quando 5 usuários
// abrem o app ao mesmo tempo, todos pedindo setlists/members/schedule).
// TTL de 30s: dados sempre frescos mas sem sobrecarregar o Appwrite.
const stateReadCache = new Map(); // key → { value, ts }
const STATE_READ_TTL_MS = 30 * 1000;

function getStateFromCache(key) {
  const entry = stateReadCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > STATE_READ_TTL_MS) { stateReadCache.delete(key); return null; }
  return entry.value;
}
function setStateInCache(key, value) {
  stateReadCache.set(key, { value, ts: Date.now() });
}
function invalidateStateCache(key) {
  stateReadCache.delete(key);
}

app.get('/api/appwrite/state/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const cached = getStateFromCache(key);
    if (cached !== null) {
      return res.json(cached);
    }
    const docs = await listDocuments(APPWRITE_APP_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.key === key);
    const result = { value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updated_at || null };
    setStateInCache(key, result);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/appwrite/state/:key', async (req, res) => {
  try {
    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(req.body.value ?? null);
    // V131.8 — Log de tamanho para diagnóstico. Appwrite rejeita > 50.000 chars.
    if (serialized.length > 49000) {
      console.warn(`[state] "${req.params.key}" = ${serialized.length} chars (próximo/acima do limite Appwrite 50000)`);
    }
    invalidateStateCache(req.params.key);
    const doc = await upsertState(APPWRITE_APP_STATE_COLLECTION_ID, d => d.key === req.params.key, {
      key: req.params.key,
      value: serialized,
      updated_at: updatedAt
    });
    res.json({ ok: true, id: doc.$id, updatedAt });
  } catch (error) {
    console.error(`[state] erro ao salvar "${req.params.key}":`, error.message);
    res.status(500).json({ error: error.message, key: req.params.key });
  }
});
// ============================================================================
// V131.18 — Repertórios como DOCUMENTOS INDIVIDUAIS (modelo de dados novo)
// Cada repertório é um documento na collection 'setlists', com setlist_id único.
// Salvar/editar/remover afeta só aquele documento — elimina o problema de
// "cria e some" e "não aparece pra todo mundo" causado por sobrescrever o
// array inteiro. Requer a collection 'setlists' criada no Appwrite.
// ============================================================================
const APPWRITE_SETLISTS_COLLECTION_ID = process.env.APPWRITE_SETLISTS_COLLECTION_ID || 'setlists';

// Lista todos os repertórios (cada documento tem: setlist_id, data JSON, updated_at)
app.get('/api/appwrite/setlists', async (req, res) => {
  try {
    const docs = await listDocuments(APPWRITE_SETLISTS_COLLECTION_ID);
    const setlists = docs.map(d => {
      try {
        const parsed = JSON.parse(d.data || '{}');
        return { ...parsed, id: d.setlist_id, _docId: d.$id, updatedAt: d.updated_at || parsed.updatedAt };
      } catch { return null; }
    }).filter(Boolean);
    res.json({ setlists });
  } catch (error) {
    console.error('[setlists] erro ao listar:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Cria ou atualiza UM repertório (upsert por setlist_id)
app.put('/api/appwrite/setlists/:setlistId', async (req, res) => {
  try {
    const setlistId = req.params.setlistId;
    const updatedAt = new Date().toISOString();
    const value = req.body.value || {};
    const serialized = JSON.stringify(value);
    if (serialized.length > 49000) {
      console.warn(`[setlists] "${setlistId}" = ${serialized.length} chars (grande)`);
    }
    const doc = await upsertState(
      APPWRITE_SETLISTS_COLLECTION_ID,
      d => d.setlist_id === setlistId,
      { setlist_id: setlistId, data: serialized, updated_at: updatedAt }
    );
    res.json({ ok: true, id: doc.$id, setlistId, updatedAt });
  } catch (error) {
    console.error(`[setlists] erro ao salvar "${req.params.setlistId}":`, error.message);
    res.status(500).json({ error: error.message, setlistId: req.params.setlistId });
  }
});

// Remove UM repertório
app.delete('/api/appwrite/setlists/:setlistId', async (req, res) => {
  try {
    const setlistId = req.params.setlistId;
    const docs = await listDocuments(APPWRITE_SETLISTS_COLLECTION_ID);
    const found = docs.find(d => d.setlist_id === setlistId);
    if (found) {
      await appwriteRequest('DELETE', `/databases/${encodeURIComponent(APPWRITE_DATABASE_ID)}/collections/${encodeURIComponent(APPWRITE_SETLISTS_COLLECTION_ID)}/documents/${encodeURIComponent(found.$id)}`);
    }
    res.json({ ok: true, setlistId, removed: !!found });
  } catch (error) {
    console.error(`[setlists] erro ao remover "${req.params.setlistId}":`, error.message);
    res.status(500).json({ error: error.message, setlistId: req.params.setlistId });
  }
});

app.get('/api/appwrite/user-state/:userId/:key', async (req, res) => {
  try {
    const docs = await listDocuments(APPWRITE_USER_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.user_id === req.params.userId && d.key === req.params.key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updated_at || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/appwrite/user-state/:userId/:key', async (req, res) => {
  try {
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_USER_STATE_COLLECTION_ID, d => d.user_id === req.params.userId && d.key === req.params.key, {
      user_id: req.params.userId,
      key: req.params.key,
      value: JSON.stringify(req.body.value ?? null),
      updated_at: updatedAt
    });
    res.json({ ok: true, id: doc.$id, updatedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

function googleMediaUrl(id) {
  return `${GOOGLE_API}/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(API_KEY)}`;
}

function requireApiKey(res) {
  if (!API_KEY) {
    res.status(500).send('GOOGLE_DRIVE_API_KEY não configurada no Render.');
    return false;
  }
  return true;
}

app.get('/api/drive', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const folderId = req.query.folderId;
    if (!folderId) return res.status(400).send('folderId obrigatório.');

    let files = [];
    let pageToken = '';

    do {
      const params = new URLSearchParams({
        key: API_KEY,
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id,name,mimeType,webViewLink)',
        pageSize: '1000',
        orderBy: 'folder,name'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${GOOGLE_API}?${params}`);
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).send(text);
      }

      const data = await response.json();
      files = files.concat(data.files || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao consultar Google Drive.');
  }
});

/* ===== V96 — /api/library: indexação consolidada com cache no servidor =====
   Antes: o cliente fazia 1 request por pasta (recursivo), N requests em série.
   Agora: o servidor varre o Drive uma vez, cacheia em memória por 30 minutos,
   e o cliente recebe TODO o catálogo em uma única chamada. Cliente que ainda
   usar /api/drive continua funcionando (compatibilidade). */

// V127.2 — Com Render Starter (sem cold start), podemos usar TTL maior.
// A biblioteca muda raramente (quando você adiciona músicas no Drive).
// 6h de cache no servidor significa que a primeira requisição do dia
// é sempre rápida; só rebusca se você forçar com ?force=1.
const LIBRARY_TTL_MS = 6 * 60 * 60 * 1000;
let libraryCache = null;       // { tracks, builtAt, rootId }
let libraryBuildPromise = null; // dedupe de chamadas concorrentes

async function listFolder(folderId) {
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      key: API_KEY,
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType,webViewLink)',
      pageSize: '1000',
      orderBy: 'folder,name'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`${GOOGLE_API}?${params}`);
    if (!response.ok) throw new Error(`Drive ${response.status}: ${await response.text()}`);
    const data = await response.json();
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

const AUDIO_EXT = ['mp3','wav','m4a','aac','ogg','flac','wma'];
const IMAGE_EXT = ['jpg','jpeg','png','webp'];
function getExt(name){ const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
function cleanTrackName(name){ return name.replace(/\.[^/.]+$/, '').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim(); }
function normalizeKeyToken(token){
  if (!token) return '';
  let key = String(token).trim().replace('♯','#').replace('♭','b');
  const minor = /m$/i.test(key);
  key = key.replace(/m$/i,'');
  const flatMap = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' };
  const proper = key.charAt(0).toUpperCase() + key.slice(1);
  const normalized = flatMap[proper] || proper.toUpperCase();
  return normalized + (minor ? 'm' : '');
}

// V99 — detectKey idêntico ao do app.js para garantir consistência.
function detectKey(text){
  // V99.1 — Detecção idêntica à do app.js para consistência total.
  const rawWithExt = String(text || '');
  let raw = rawWithExt
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .trim();

  // V99.1 — pré-processamento
  raw = raw
    .replace(/\s*\(\d+\)\s*$/i, '')
    .replace(/\s*-\s*c[oó]pia\s*$/i, '')
    .replace(/([A-G])m#/g, '$1#m')
    .replace(/\s+/g, ' ')
    .trim();

  const noAccents = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const PT_NAMES = {
    'do':'C', 're':'D', 'mi':'E', 'fa':'F', 'sol':'G', 'la':'A', 'si':'B'
  };
  const ptRegex = /\b(do|re|mi|fa|sol|la|si)(#|b\b|\s*sustenido|\s*bemol)?(\s*menor|\s*maior|m\b)?/gi;
  const ptMatches = [];
  let ptMatch;
  while ((ptMatch = ptRegex.exec(noAccents)) !== null) {
    const note = PT_NAMES[ptMatch[1].toLowerCase()];
    if (!note) continue;
    let suffix = '';
    if (ptMatch[2]) {
      const mod = ptMatch[2].trim().toLowerCase();
      if (mod === '#' || mod === 'sustenido') suffix = '#';
      else if (mod === 'b' || mod === 'bemol') suffix = 'b';
    }
    const minor = ptMatch[3] && /m|menor/i.test(ptMatch[3]) ? 'm' : '';
    ptMatches.push({ key: note + suffix + minor, index: ptMatch.index, raw: ptMatch[0] });
  }
  const ptValid = ptMatches.filter(m => {
    const before = noAccents.slice(0, m.index).toLowerCase();
    const after = noAccents.slice(m.index + m.raw.length).toLowerCase();
    const followsContext = /(tom\s*(?:de)?|tone|key|em)\s*[:=\-]?\s*$/.test(before);
    const isAtEnd = m.index + m.raw.length >= noAccents.length - 6;
    if (followsContext) return true;
    const lowerRaw = m.raw.toLowerCase().trim();
    if (lowerRaw === 'do' || lowerRaw === 'da') {
      const isolated = /^[\s\)\]\}]*$/.test(after) && /[\s\(\[\{\-]$/.test(before);
      if (!isolated) return false;
    }
    return isAtEnd;
  });
  if (ptValid.length) {
    return normalizeKeyToken(ptValid[ptValid.length - 1].key);
  }

  const token = '(?:C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|A|B|C|D|E|F|G)(?:m)?';
  const explicit = new RegExp(
    `\\b(?:tom\\s+de|tom|tone|key)\\s*[:=\\-]?\\s*(${token})(?=$|[\\s_\\-\\.\\)\\]\\}])`,
    'i'
  );
  const explicitMatch = noAccents.match(explicit);
  if (explicitMatch) return normalizeKeyToken(explicitMatch[1]);

  const matches = [];
  const re = new RegExp(`(^|[\\s_\\-\\(\\[\\{])(${token})(?=$|[\\s_\\-\\.\\)\\]\\}])`, 'gi');
  let match;
  while ((match = re.exec(noAccents)) !== null) {
    const sep = match[1] || '';
    const key = match[2];
    const index = match.index + sep.length;
    const end = index + key.length;
    const before = noAccents.slice(0, index);
    const after = noAccents.slice(end);

    if (/^em$/i.test(key)) {
      const trimmedAfter = after.trimStart();
      if (/^[a-zA-Z]/.test(trimmedAfter)) continue;
    }

    // V99.1 — Filtro de 1 letra reformulado
    if (key.length === 1) {
      const beforeTrim = before.replace(/\s+$/, '');
      const lastCharBefore = beforeTrim.charAt(beforeTrim.length - 1);
      const isAfterHyphen = lastCharBefore === '-';
      const isInBrackets = /[\(\[\{]/.test(lastCharBefore);
      const afterTrim = after.replace(/^\s+/, '');
      const firstCharAfter = afterTrim.charAt(0);
      const isLastToken = afterTrim === '' || firstCharAfter === '-' || /[\)\]\}\.]/.test(firstCharAfter) || /^\d/.test(afterTrim);
      const startsAtBeginning = index === 0;
      const acceptable = isAfterHyphen || isInBrackets || (isLastToken && !startsAtBeginning);
      if (!acceptable) continue;
    }

    matches.push({ key, index, end });
  }
  if (!matches.length) return '';
  matches.sort((a, b) => {
    const aAtEnd = a.end >= noAccents.length - 8 ? 0 : 1;
    const bAtEnd = b.end >= noAccents.length - 8 ? 0 : 1;
    if (aAtEnd !== bAtEnd) return aAtEnd - bAtEnd;
    return b.index - a.index;
  });
  return normalizeKeyToken(matches[0].key);
}

async function buildLibrary(rootFolderId) {
  // V131.22 — CORREÇÃO DE BUG: a desduplicação por nome era feita DURANTE a
  // varredura paralela de pastas (até 4 simultâneas). Como a ordem de chegada
  // dos resultados depende do tempo de resposta da rede, quando havia dois
  // arquivos com nomes parecidos (ex: duas versões de "Galileu" em pastas
  // diferentes), o "vencedor" da deduplicação podia MUDAR a cada reconstrução
  // da biblioteca — fazendo o ID de uma música variar sem motivo aparente.
  // Isso causava o sumiço da música em repertórios (o ID salvo virava órfão).
  //
  // Agora: primeiro coletamos TODOS os candidatos (a varredura continua
  // paralela, só para velocidade), e SÓ DEPOIS, com a lista completa,
  // ordenamos de forma ESTÁVEL (por caminho da pasta + nome do arquivo) antes
  // de decidir qual arquivo vence em caso de nome duplicado. Assim, o mesmo
  // arquivo físico sempre vence, toda vez — o resultado é sempre igual.
  const candidatos = [];

  async function walk(folderId, singerName, inheritedCover, folderPath) {
    const files = await listFolder(folderId);
    const audioFiles = files.filter(f =>
      f.mimeType !== 'application/vnd.google-apps.folder' &&
      AUDIO_EXT.includes(getExt(f.name))
    );
    const imageFiles = files.filter(f =>
      f.mimeType !== 'application/vnd.google-apps.folder' &&
      IMAGE_EXT.includes(getExt(f.name))
    );
    const subfolders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const cover = imageFiles.length
      ? `/api/audio/${encodeURIComponent(imageFiles[0].id)}`
      : inheritedCover;
    for (const f of audioFiles) {
      candidatos.push({ f, singerName: singerName || 'Diversos', cover: cover || '', folderPath: folderPath || '' });
    }
    const queue = [...subfolders];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const folder = queue.shift();
        if (!folder) break;
        await walk(folder.id, singerName || folder.name, cover, `${folderPath || ''}/${folder.name}`);
      }
    });
    await Promise.all(workers);
  }
  await walk(rootFolderId, '', '', '');

  // Ordenação ESTÁVEL e determinística: mesmo caminho de pasta + nome sempre
  // produz a mesma ordem, independente da velocidade de rede.
  candidatos.sort((a, b) => {
    const pathCmp = a.folderPath.localeCompare(b.folderPath, 'pt-BR');
    if (pathCmp !== 0) return pathCmp;
    return a.f.name.localeCompare(b.f.name, 'pt-BR');
  });

  const tracks = [];
  const seen = new Set();
  const seenNames = new Set();
  let dupedByName = 0;
  for (const { f, singerName, cover } of candidatos) {
    if (seen.has(f.id)) continue;
    const normalizedName = String(f.name)
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[\s_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalizedName && seenNames.has(normalizedName)) {
      dupedByName++;
      continue;
    }
    seen.add(f.id);
    if (normalizedName) seenNames.add(normalizedName);
    tracks.push({
      id: f.id,
      fileName: f.name,
      name: cleanTrackName(f.name),
      singer: singerName,
      ext: getExt(f.name),
      key: detectKey(f.name),
      tags: [],
      coverUrl: cover
    });
  }
  if (dupedByName > 0) console.log(`[library] ${dupedByName} duplicata(s) por nome removida(s) (escolha agora estável).`);
  tracks.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  return tracks;
}

app.get('/api/library', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const rootId = req.query.rootId || req.query.folderId;
    if (!rootId) return res.status(400).json({ error: 'rootId obrigatório.' });

    const now = Date.now();
    const fresh = libraryCache &&
                  libraryCache.rootId === rootId &&
                  (now - libraryCache.builtAt) < LIBRARY_TTL_MS;

    if (fresh && !req.query.force) {
      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=21600');
      res.setHeader('X-Library-Cache', 'hit');
      return res.json({
        tracks: libraryCache.tracks,
        builtAt: libraryCache.builtAt,
        count: libraryCache.tracks.length,
        cached: true
      });
    }

    // Dedupe: se outro request já está rebuildando, espera ele
    if (!libraryBuildPromise) {
      libraryBuildPromise = (async () => {
        try {
          const tracks = await buildLibrary(rootId);
          libraryCache = { tracks, builtAt: Date.now(), rootId };
          return tracks;
        } finally {
          libraryBuildPromise = null;
        }
      })();
    }
    const tracks = await libraryBuildPromise;
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=21600');
    res.setHeader('X-Library-Cache', 'miss');
    res.json({
      tracks,
      builtAt: libraryCache.builtAt,
      count: tracks.length,
      cached: false
    });
  } catch (error) {
    console.error('Erro em /api/library:', error);
    // Em caso de erro, devolve último cache se houver
    if (libraryCache) {
      res.setHeader('X-Library-Cache', 'stale-on-error');
      return res.json({
        tracks: libraryCache.tracks,
        builtAt: libraryCache.builtAt,
        count: libraryCache.tracks.length,
        cached: true,
        stale: true,
        error: error.message
      });
    }
    res.status(500).json({ error: error.message || 'Erro ao indexar biblioteca.' });
  }
});

// Health check leve, útil para pings de uptime gratuitos (cron-job.org / UptimeRobot)
// /ping — keep-alive minimalista para cron-job.org (2 bytes, nunca dá "Response too big")
app.get('/ping', (req, res) => res.send('ok'));

app.get('/healthz', (req, res) => {
  let withKey = 0, withoutKey = 0;
  if (libraryCache && libraryCache.tracks) {
    for (const t of libraryCache.tracks) {
      if (t.key && t.key !== '—' && t.key !== '') withKey++;
      else withoutKey++;
    }
  }
  res.json({
    ok: true,
    libraryCached: !!libraryCache,
    libraryAge: libraryCache ? (Date.now() - libraryCache.builtAt) : null,
    libraryCount: libraryCache ? libraryCache.tracks.length : 0,
    keyDetection: {
      withKey,
      withoutKey,
      pct: libraryCache && libraryCache.tracks.length
        ? Math.round((withKey / libraryCache.tracks.length) * 100)
        : 0
    }
  });
});

// V99 — Endpoint diagnóstico: lista as músicas SEM tom detectado.
// Útil para o David ver quais nomes precisam ser ajustados no Drive.
// V131.9 — Diagnóstico de áudio: testa o download real de um arquivo
// e retorna o erro EXATO do Google Drive. Use /api/diagnostics/audio/:id
app.get('/api/diagnostics/audio/:id', async (req, res) => {
  const id = req.params.id;
  const result = { id, apiKeyPresent: !!API_KEY, tests: {} };
  try {
    // Teste 1: metadata (Drive API)
    const metaUrl = `${GOOGLE_API}/${encodeURIComponent(id)}?fields=id,name,mimeType,size&key=${encodeURIComponent(API_KEY)}`;
    const metaRes = await fetch(metaUrl, { headers: { 'User-Agent': 'VSLouvor/1.0' } });
    result.tests.metadata = { status: metaRes.status, ok: metaRes.ok };
    if (!metaRes.ok) {
      result.tests.metadata.body = (await metaRes.text()).slice(0, 300);
    } else {
      result.tests.metadata.data = await metaRes.json();
    }

    // Teste 2: download de mídia (alt=media)
    const mediaUrl = `${GOOGLE_API}/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(API_KEY)}`;
    const mediaRes = await fetch(mediaUrl, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'VSLouvor/1.0', 'Range': 'bytes=0-1023' } });
    result.tests.media = { status: mediaRes.status, ok: mediaRes.ok, contentType: mediaRes.headers.get('content-type'), location: mediaRes.headers.get('location') };
    if (!mediaRes.ok && mediaRes.status < 300) {
      result.tests.media.body = (await mediaRes.text()).slice(0, 300);
    }
  } catch (e) {
    result.error = e.message;
  }
  res.json(result);
});

// V131.22 — Diagnóstico: procura por música(s) com nome parecido na biblioteca
// já indexada, mostrando TODOS os arquivos que batem (mesmo os que a
// deduplicação descartou), para confirmar se há duplicatas causando
// instabilidade de ID. Use /api/diagnostics/find-duplicates?q=galileu
app.get('/api/diagnostics/find-duplicates', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const q = String(req.query.q || '').toLowerCase().trim();
    if (!q) return res.status(400).json({ error: 'Parâmetro ?q= obrigatório (nome ou parte do nome a buscar).' });

    // Busca DIRETO no Google Drive (não usa o cache da biblioteca), então
    // mostra TODOS os arquivos que existem agora, incluindo duplicatas.
    const searchUrl = `${GOOGLE_API}?q=${encodeURIComponent(`name contains '${q}' and trashed = false`)}&fields=files(id,name,parents,mimeType,createdTime,modifiedTime)&pageSize=50&key=${encodeURIComponent(API_KEY)}`;
    const driveRes = await fetch(searchUrl, { headers: { 'User-Agent': 'VSLouvor/1.0' } });
    if (!driveRes.ok) {
      return res.status(driveRes.status).json({ error: await driveRes.text() });
    }
    const data = await driveRes.json();
    const files = (data.files || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    res.json({
      query: q,
      totalEncontrado: files.length,
      duplicataProvavel: files.length > 1,
      arquivos: files.map(f => ({ id: f.id, name: f.name, createdTime: f.createdTime, modifiedTime: f.modifiedTime }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/diagnostics/missing-keys', (req, res) => {
  if (!libraryCache) {
    return res.json({ ready: false, message: 'Biblioteca ainda não foi indexada. Acesse /api/library?rootId=...' });
  }
  const missing = libraryCache.tracks
    .filter(t => !t.key || t.key === '—' || t.key === '')
    .map(t => ({ id: t.id, fileName: t.fileName, singer: t.singer }));
  res.json({
    ready: true,
    total: libraryCache.tracks.length,
    missingCount: missing.length,
    missing
  });
});


/* ===================================================================
   V110 — Log de acessos e listagem de usuários cadastrados
   =================================================================== */

// Log em memória — persiste enquanto o servidor está rodando.
const ACCESS_LOG = [];
const ACCESS_LOG_MAX = 1000;

// POST /api/admin/access-log — recebe eventos de login/cadastro do frontend.
app.post('/api/admin/access-log', (req, res) => {
  try {
    const { type, userId, name, email, at, ua } = req.body || {};
    if (!type || !email) return res.status(400).json({ error: 'type e email são obrigatórios.' });
    const entry = {
      type,
      userId: userId || null,
      name: name || email,
      email,
      at: at || new Date().toISOString(),
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '',
      ua: (ua || '').slice(0, 200)
    };
    ACCESS_LOG.unshift(entry);
    if (ACCESS_LOG.length > ACCESS_LOG_MAX) ACCESS_LOG.length = ACCESS_LOG_MAX;
    console.log(`[acesso] ${entry.type} — ${entry.email} — ${entry.at}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/access-log — retorna o log em memória.
app.get('/api/admin/access-log', (req, res) => {
  const type = req.query.type;
  const entries = type ? ACCESS_LOG.filter(e => e.type === type) : ACCESS_LOG;
  res.json({ count: entries.length, entries });
});

// GET /api/admin/users — lista usuários a partir do log de acessos
// (não requer escopo users.read no Appwrite — usa dados já registrados no sistema)
app.get('/api/admin/users', async (req, res) => {
  try {
    // Tenta via Appwrite Users API (requer escopo users.read na API Key)
    if (appwriteReady()) {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;
      const search = req.query.search || '';
      const params = new URLSearchParams({ limit, offset });
      if (search) params.set('search', search);

      const r = await fetch(`${APPWRITE_ENDPOINT}/users?${params}`, {
        headers: appwriteHeaders()
      }).catch(() => null);

      if (r && r.ok) {
        const data = await r.json();
        const users = (data.users || []).map(u => ({
          id: u.$id,
          name: u.name || '',
          email: u.email || '',
          status: u.status,
          emailVerification: u.emailVerification,
          createdAt: u.$createdAt,
          updatedAt: u.$updatedAt,
          accessedAt: u.accessedAt,
          prefs: u.prefs || {}
        }));
        return res.json({ total: data.total, limit, offset, users, source: 'appwrite' });
      }
    }

    // Fallback: monta lista a partir do log de acessos em memória
    // (mostra quem já acessou o sistema nesta sessão do servidor)
    const seen = new Map();
    for (const entry of ACCESS_LOG) {
      if (!entry.email) continue;
      if (!seen.has(entry.email)) {
        seen.set(entry.email, {
          id: entry.userId || '',
          name: entry.name || entry.email,
          email: entry.email,
          status: true,
          createdAt: null,
          accessedAt: entry.at,
          source: 'log'
        });
      }
    }
    const users = [...seen.values()];
    return res.json({
      total: users.length,
      limit: users.length,
      offset: 0,
      users,
      source: 'log',
      notice: 'Dados do log de acessos desta sessão. Para lista completa, configure users.read na API Key do Appwrite.'
    });
  } catch (e) {
    console.error('[admin/users]', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/audio/:id', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const id = req.params.id;
    const driveMediaUrl = googleMediaUrl(id);

    // V131.13 — Réplica EXATA do diagnóstico que retornou 206 com sucesso.
    // Encaminha Range, redirect:follow, e faz pipe. Logs detalhados em cada
    // etapa para identificar exatamente onde falha se der erro.
    const upstreamHeaders = { 'User-Agent': 'VSLouvor/1.0' };
    if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

    let driveRes;
    try {
      driveRes = await fetch(driveMediaUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: upstreamHeaders
      });
    } catch (fetchErr) {
      console.error('[audio] fetch falhou:', fetchErr.name, fetchErr.message);
      return res.status(502).json({ stage: 'fetch', error: fetchErr.message, name: fetchErr.name });
    }

    console.log(`[audio] ${id}: status ${driveRes.status}, type ${driveRes.headers.get('content-type')}`);

    if (!driveRes.ok && driveRes.status !== 206) {
      const errBody = await driveRes.text().catch(() => '');
      console.error(`[audio] Drive ${driveRes.status}:`, errBody.slice(0, 200));
      return res.status(driveRes.status).json({ stage: 'drive-response', status: driveRes.status, body: errBody.slice(0, 200) });
    }

    res.status(driveRes.status);
    res.setHeader('Content-Type', driveRes.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Accept-Ranges', driveRes.headers.get('accept-ranges') || 'bytes');
    const cl = driveRes.headers.get('content-length');
    const cr = driveRes.headers.get('content-range');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');

    if (req.query.download) {
      res.setHeader('Content-Disposition', `attachment; filename="${req.query.filename || 'audio.mp3'}"`);
    }

    // node-fetch v2: body é stream Node. Trata erro de pipe sem derrubar.
    driveRes.body.on('error', (err) => {
      console.error('[audio] stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
      else try { res.end(); } catch(_) {}
    });
    driveRes.body.pipe(res);

  } catch (error) {
    console.error('[audio] catch geral:', error.name, error.message, error.stack?.split('\n')[1]);
    if (!res.headersSent) res.status(500).json({ stage: 'catch', error: error.message, name: error.name });
  }
});

app.get('/api/transpose/:id', async (req, res) => {
  if (!requireApiKey(res)) return;
  const id = req.params.id;
  const semitones = Math.max(-12, Math.min(12, Number(req.query.semitones || 0)));
  const factor = Math.pow(2, semitones / 12);
  const tempo = 1 / factor;

  try {
    const response = await fetch(googleMediaUrl(id));
    if (!response.ok) return res.status(response.status).send(await response.text());

    res.setHeader('Content-Type', 'audio/mpeg');
    if (req.query.download) {
      const filename = req.query.filename || `audio_tom_${semitones}.mp3`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    // Transposição simples com FFmpeg.
    // Mantém aproximadamente o andamento usando atempo, e altera pitch via asetrate.
    const filter = `asetrate=44100*${factor},aresample=44100,atempo=${tempo}`;
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-filter:a', filter,
      '-f', 'mp3',
      '-b:a', '192k',
      'pipe:1'
    ];

    const proc = spawn(ffmpeg, args);
    response.body.pipe(proc.stdin);
    proc.stdout.pipe(res);

    proc.stderr.on('data', data => console.error(String(data)));
    proc.on('close', code => {
      if (code !== 0) console.error(`FFmpeg finalizou com código ${code}`);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao transpor áudio.');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// V120 — Error handler global: captura erros do serve-static e outros
// middleware sem deixar o processo travar.
app.use((err, req, res, next) => {
  // Arquivo estático não encontrado — retorna 404 silencioso
  if (err.code === 'ENOENT' || err.status === 404) {
    return res.status(404).send('Not found');
  }
  console.error(`[server error] ${req.method} ${req.url}:`, err.message || err);
  res.status(err.status || 500).send(err.message || 'Internal server error');
});

// V131 — Timeouts maiores conforme recomendação oficial do Render para
// serviços Node.js com streaming. Evita "Connection reset by peer" e 500
// intermitentes durante o streaming de áudios grandes do Google Drive.
const server = app.listen(PORT, () => {
  console.log(`VS Louvor rodando em http://localhost:${PORT}`);
});
server.keepAliveTimeout = 120000;  // 120s (padrão é 5s)
server.headersTimeout = 120000;    // 120s
server.requestTimeout = 0;         // sem limite para streams longos
