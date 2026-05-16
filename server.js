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

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Assets podem ser cacheados longamente (o navegador valida com ETag).
    if (/\.(png|jpg|jpeg|webp|svg|gif|woff2?|ttf|eot)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
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
const APPWRITE_ADMIN_EMAILS = (process.env.APPWRITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

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
  res.json({ endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID, databaseId: APPWRITE_DATABASE_ID, ready: appwriteReady(), adminEmails: APPWRITE_ADMIN_EMAILS, adminConfigured: APPWRITE_ADMIN_EMAILS.length > 0 });
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
app.get('/api/appwrite/state/:key', async (req, res) => {
  try {
    const docs = await listDocuments(APPWRITE_APP_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.key === req.params.key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updated_at || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/appwrite/state/:key', async (req, res) => {
  try {
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

const LIBRARY_TTL_MS = 30 * 60 * 1000;
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
  const raw = String(text || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
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
    const after = noAccents.slice(end);
    if (/^em$/i.test(key)) {
      const trimmedAfter = after.trimStart();
      if (/^[a-zA-Z]/.test(trimmedAfter)) continue;
    }
    if (key.length === 1 && index === 0) {
      const okStartContext = /^\s*[\-\(\[\{]/.test(after) || /^\s*\d/.test(after.trimStart());
      if (!okStartContext) continue;
    }
    if (key.length === 1 && sep !== '' && !/[\-\(\[\{]/.test(sep)) {
      if (!/^\s*(\d|$)/.test(after)) continue;
    }
    matches.push({ key, index, end });
  }
  if (!matches.length) return '';  // servidor retorna '' (não '—') para deixar cliente formatar
  matches.sort((a, b) => {
    const aAtEnd = a.end >= noAccents.length - 8 ? 0 : 1;
    const bAtEnd = b.end >= noAccents.length - 8 ? 0 : 1;
    if (aAtEnd !== bAtEnd) return aAtEnd - bAtEnd;
    return b.index - a.index;
  });
  return normalizeKeyToken(matches[0].key);
}

async function buildLibrary(rootFolderId) {
  // Recursão BFS com paralelização limitada (até 4 pastas simultâneas)
  const tracks = [];
  const seen = new Set();
  const seenNames = new Set();
  let dupedByName = 0;
  async function walk(folderId, singerName, inheritedCover) {
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
      if (seen.has(f.id)) continue;
      // V99 — desduplicação extra por nome normalizado
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
        singer: singerName || 'Diversos',
        ext: getExt(f.name),
        key: detectKey(f.name),
        tags: [],
        coverUrl: cover || ''
      });
    }
    const queue = [...subfolders];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const folder = queue.shift();
        if (!folder) break;
        await walk(folder.id, singerName || folder.name, cover);
      }
    });
    await Promise.all(workers);
  }
  await walk(rootFolderId, '', '');
  if (dupedByName > 0) console.log(`[library] ${dupedByName} duplicata(s) por nome removida(s).`);
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
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
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
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
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

app.get('/api/audio/:id', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const id = req.params.id;
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;

    const response = await fetch(googleMediaUrl(id), { headers });
    if (!response.ok && response.status !== 206) {
      return res.status(response.status).send(await response.text());
    }

    res.status(response.status);
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    // Cache longo no navegador/SW: áudios são imutáveis por id do Drive.
    // Quando é range (206), evitamos cachear (resposta parcial).
    if (response.status === 200 && !req.headers.range) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    if (req.query.download) {
      const filename = req.query.filename || 'audio.mp3';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    response.body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar áudio.');
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

app.listen(PORT, () => {
  console.log(`VS Louvor rodando em http://localhost:${PORT}`);
});
