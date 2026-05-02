const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================
// Config / segredos
// =============================================================
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';
const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'louvor_avida';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || '';
const APPWRITE_APP_STATE_COLLECTION_ID = process.env.APPWRITE_APP_STATE_COLLECTION_ID || 'app_state';
const APPWRITE_USER_STATE_COLLECTION_ID = process.env.APPWRITE_USER_STATE_COLLECTION_ID || 'user_state';
const APPWRITE_ADMIN_EMAILS = (process.env.APPWRITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Diretório para cache de transposições
const TRANSPOSE_CACHE_DIR = process.env.TRANSPOSE_CACHE_DIR || path.join(require('os').tmpdir(), 'vs-louvor-transpose-cache');
try { fs.mkdirSync(TRANSPOSE_CACHE_DIR, { recursive: true }); } catch {}

// Limite máximo de tamanho do cache em disco (default 500MB)
const TRANSPOSE_CACHE_MAX_BYTES = Number(process.env.TRANSPOSE_CACHE_MAX_BYTES || 500 * 1024 * 1024);

// =============================================================
// Hardening: helmet com CSP customizada
// =============================================================
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.jsdelivr.net"],
      // styles inline existem em alguns lugares (style="...") — manter por compatibilidade
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https://drive.google.com", "https://*.googleusercontent.com"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'", APPWRITE_ENDPOINT, "https://www.googleapis.com"].filter(Boolean),
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Confiar no proxy do Render (importante para rate limit funcionar com IP real)
app.set('trust proxy', 1);

// =============================================================
// Rate limiters
// =============================================================
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' }
});

const transposeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de transposições atingido. Aguarde 1 minuto.' }
});

app.use('/api/', apiLimiter);

// =============================================================
// Body parser e estáticos
// =============================================================
app.use(express.json({ limit: '2mb' }));

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(png|jpg|jpeg|svg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  }
}));

// =============================================================
// Helpers Appwrite
// =============================================================
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
async function appwriteRequest(method, urlPath, body) {
  if (!appwriteReady()) throw new Error('Appwrite não configurado no servidor.');
  const response = await fetch(`${APPWRITE_ENDPOINT}${urlPath}`, {
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

// =============================================================
// Endpoint público de config — SEM expor adminEmails
// =============================================================
app.get('/api/appwrite/config', (req, res) => {
  res.json({
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID,
    databaseId: APPWRITE_DATABASE_ID,
    ready: appwriteReady(),
    adminConfigured: APPWRITE_ADMIN_EMAILS.length > 0
    // adminEmails: REMOVIDO por questão de privacidade
  });
});

// Endpoint que diz se o usuário autenticado é admin (sem expor a lista de emails)
app.get('/api/appwrite/me', async (req, res) => {
  try {
    const user = await verifyAppwriteJWT(req);
    const email = String(user?.email || '').toLowerCase();
    const isAdmin = APPWRITE_ADMIN_EMAILS.length > 0 && APPWRITE_ADMIN_EMAILS.includes(email);
    res.json({ id: user.$id, email: user.email, name: user.name, isAdmin });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// =============================================================
// Health check
// =============================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    appwrite: appwriteReady(),
    drive: Boolean(API_KEY),
    cacheDir: TRANSPOSE_CACHE_DIR,
    cacheLimitMB: Math.round(TRANSPOSE_CACHE_MAX_BYTES / (1024 * 1024))
  });
});

// =============================================================
// Auth: validar JWT do Appwrite
// =============================================================
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
async function requireAuthUser(req, res) {
  try {
    return await verifyAppwriteJWT(req);
  } catch (error) {
    res.status(401).json({ error: error.message });
    return null;
  }
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
      res.status(403).json({ error: 'Usuário sem permissão para esta ação.' });
      return null;
    }
    return user;
  } catch (error) {
    res.status(401).json({ error: error.message });
    return null;
  }
}

// =============================================================
// Validação de chaves permitidas (defesa em profundidade)
// =============================================================
const ADMIN_KEYS_REGEX = /^(members|monthlySchedule(?::\d{4}-\d{2})?)$/;
const USER_WRITABLE_KEYS_REGEX = /^(setlists)$/;
const USER_STATE_KEYS_REGEX = /^(favorites)$/;

function isValidKey(key, regex) {
  return typeof key === 'string' && key.length > 0 && key.length <= 100 && regex.test(key);
}

// =============================================================
// Rotas Appwrite — leitura pública (read-only)
// =============================================================
app.get('/api/appwrite/state/:key', async (req, res) => {
  try {
    const key = req.params.key;
    if (!isValidKey(key, ADMIN_KEYS_REGEX) && !isValidKey(key, USER_WRITABLE_KEYS_REGEX)) {
      return res.status(400).json({ error: 'Chave inválida.' });
    }
    const docs = await listDocuments(APPWRITE_APP_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.key === key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updatedAt || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PUT — usuário comum só pode gravar chaves explicitamente liberadas
app.put('/api/appwrite/state/:key', async (req, res) => {
  try {
    const key = req.params.key;
    if (!isValidKey(key, USER_WRITABLE_KEYS_REGEX)) {
      return res.status(403).json({ error: 'Esta chave exige permissão de administrador.' });
    }
    const user = await requireAuthUser(req, res);
    if (!user) return;
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_APP_STATE_COLLECTION_ID, d => d.key === key, {
      key,
      value: JSON.stringify(req.body.value ?? null),
      updatedAt,
      updatedBy: String(user.name || user.email || 'Usuário').slice(0, 255)
    });
    res.json({ ok: true, id: doc.$id, updatedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PUT admin — chaves administrativas
app.put('/api/appwrite/admin/state/:key', async (req, res) => {
  try {
    const key = req.params.key;
    if (!isValidKey(key, ADMIN_KEYS_REGEX)) {
      return res.status(400).json({ error: 'Chave administrativa inválida.' });
    }
    const admin = await requireAdminUser(req, res);
    if (!admin) return;
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_APP_STATE_COLLECTION_ID, d => d.key === key, {
      key,
      value: JSON.stringify(req.body.value ?? null),
      updatedAt,
      updatedBy: String(admin.name || admin.email || 'Administrador').slice(0, 255)
    });
    res.json({ ok: true, id: doc.$id, updatedAt, updatedBy: admin.name || admin.email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// User state — usuário só lê e escreve sobre o próprio ID
app.get('/api/appwrite/user-state/:userId/:key', async (req, res) => {
  try {
    const { userId, key } = req.params;
    if (!isValidKey(key, USER_STATE_KEYS_REGEX)) {
      return res.status(400).json({ error: 'Chave de estado de usuário inválida.' });
    }
    const docs = await listDocuments(APPWRITE_USER_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.userId === userId && d.key === key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updatedAt || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/appwrite/user-state/:userId/:key', async (req, res) => {
  try {
    const { userId, key } = req.params;
    if (!isValidKey(key, USER_STATE_KEYS_REGEX)) {
      return res.status(400).json({ error: 'Chave de estado de usuário inválida.' });
    }
    const user = await requireAuthUser(req, res);
    if (!user) return;
    if (user.$id !== userId) {
      return res.status(403).json({ error: 'Você só pode alterar seus próprios dados.' });
    }
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_USER_STATE_COLLECTION_ID, d => d.userId === userId && d.key === key, {
      userId,
      key,
      value: JSON.stringify(req.body.value ?? null),
      updatedAt,
      userName: String(user.name || user.email || 'Usuário').slice(0, 255)
    });
    res.json({ ok: true, id: doc.$id, updatedAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================
// Google Drive — com cache em memória
// =============================================================
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

const driveListCache = new Map();
const DRIVE_CACHE_TTL_MS = Number(process.env.DRIVE_CACHE_TTL_MS || 5 * 60 * 1000);

function safeFolderId(raw) {
  return /^[A-Za-z0-9_\-]{10,80}$/.test(String(raw || '')) ? String(raw) : '';
}

app.get('/api/drive', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const folderId = safeFolderId(req.query.folderId);
    if (!folderId) return res.status(400).send('folderId inválido.');

    const force = req.query.force === '1';
    const cacheKey = folderId;
    const cached = driveListCache.get(cacheKey);
    if (!force && cached && Date.now() < cached.expires) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.files);
    }

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

    driveListCache.set(cacheKey, { files, expires: Date.now() + DRIVE_CACHE_TTL_MS });
    res.setHeader('X-Cache', 'MISS');
    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao consultar Google Drive.');
  }
});

// =============================================================
// Sanitização de filename para Content-Disposition
// =============================================================
function sanitizeFilenameForHeader(name) {
  return String(name || 'audio.mp3')
    .replace(/[\r\n"\\]/g, '')
    .replace(/[^\w\s.\-+()]/g, '_')
    .slice(0, 200) || 'audio.mp3';
}

function safeId(raw) {
  return /^[A-Za-z0-9_\-]{10,80}$/.test(String(raw || '')) ? String(raw) : '';
}

// =============================================================
// /api/audio/:id — proxy do Drive com Range
// =============================================================
app.get('/api/audio/:id', async (req, res) => {
  try {
    if (!requireApiKey(res)) return;
    const id = safeId(req.params.id);
    if (!id) return res.status(400).send('id inválido.');
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

    if (req.query.download) {
      const filename = sanitizeFilenameForHeader(req.query.filename || 'audio.mp3');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    response.body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar áudio.');
  }
});

// =============================================================
// /api/transpose/:id — com cache em disco
// =============================================================
function transposeCachePath(id, semitones) {
  const hash = crypto.createHash('sha1').update(`${id}:${semitones}`).digest('hex');
  return path.join(TRANSPOSE_CACHE_DIR, `${hash}.mp3`);
}

async function pruneTransposeCacheIfNeeded() {
  try {
    const entries = await fsp.readdir(TRANSPOSE_CACHE_DIR);
    let total = 0;
    const stats = [];
    for (const entry of entries) {
      const fp = path.join(TRANSPOSE_CACHE_DIR, entry);
      try {
        const s = await fsp.stat(fp);
        if (s.isFile()) {
          stats.push({ fp, size: s.size, atime: s.atimeMs });
          total += s.size;
        }
      } catch {}
    }
    if (total <= TRANSPOSE_CACHE_MAX_BYTES) return;
    stats.sort((a, b) => a.atime - b.atime);
    const target = TRANSPOSE_CACHE_MAX_BYTES * 0.8;
    let cur = total;
    for (const s of stats) {
      if (cur <= target) break;
      try { await fsp.unlink(s.fp); cur -= s.size; } catch {}
    }
  } catch (error) {
    console.warn('Falha ao limpar cache de transposições:', error.message);
  }
}

app.get('/api/transpose/:id', transposeLimiter, async (req, res) => {
  if (!requireApiKey(res)) return;
  const id = safeId(req.params.id);
  if (!id) return res.status(400).send('id inválido.');
  const semitones = Math.max(-12, Math.min(12, Math.trunc(Number(req.query.semitones || 0))));
  const factor = Math.pow(2, semitones / 12);
  const tempo = 1 / factor;

  const cachePath = transposeCachePath(id, semitones);
  const downloadName = req.query.download ? sanitizeFilenameForHeader(req.query.filename || `audio_tom_${semitones}.mp3`) : '';

  // Tenta servir do cache
  try {
    const stat = await fsp.stat(cachePath);
    if (stat.isFile() && stat.size > 0) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Cache', 'HIT');
      if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      const now = new Date();
      fsp.utimes(cachePath, now, now).catch(() => {});
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (m) {
          const start = Number(m[1]);
          const end = m[2] ? Number(m[2]) : stat.size - 1;
          if (start <= end && end < stat.size) {
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', end - start + 1);
            return fs.createReadStream(cachePath, { start, end }).pipe(res);
          }
        }
      }
      res.setHeader('Content-Length', stat.size);
      return fs.createReadStream(cachePath).pipe(res);
    }
  } catch {
    // arquivo não existe, segue para gerar
  }

  try {
    const response = await fetch(googleMediaUrl(id));
    if (!response.ok) return res.status(response.status).send(await response.text());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cache', 'MISS');
    if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

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

    const tmpCachePath = `${cachePath}.tmp.${process.pid}`;
    const cacheStream = fs.createWriteStream(tmpCachePath);
    let cacheError = false;
    cacheStream.on('error', () => { cacheError = true; });

    response.body.pipe(proc.stdin);
    proc.stdout.on('data', chunk => {
      res.write(chunk);
      if (!cacheError) cacheStream.write(chunk);
    });
    proc.stdout.on('end', () => {
      res.end();
      cacheStream.end(() => {
        if (cacheError) {
          fsp.unlink(tmpCachePath).catch(() => {});
        } else {
          fsp.rename(tmpCachePath, cachePath)
            .then(() => pruneTransposeCacheIfNeeded())
            .catch(() => fsp.unlink(tmpCachePath).catch(() => {}));
        }
      });
    });

    proc.stderr.on('data', data => console.error(String(data)));
    proc.on('close', code => {
      if (code !== 0) {
        console.error(`FFmpeg finalizou com código ${code}`);
        cacheError = true;
        fsp.unlink(tmpCachePath).catch(() => {});
      }
    });
    proc.on('error', err => {
      console.error('FFmpeg erro:', err);
      cacheError = true;
      try { res.end(); } catch {}
      fsp.unlink(tmpCachePath).catch(() => {});
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao transpor áudio.');
  }
});

// =============================================================
// Fallback SPA
// =============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VS Louvor rodando em http://localhost:${PORT}`);
  console.log(`Cache de transposições em: ${TRANSPOSE_CACHE_DIR}`);
});
