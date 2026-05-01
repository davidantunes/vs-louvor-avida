const express = require('express');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção, prefira definir GOOGLE_DRIVE_API_KEY nas variáveis de ambiente.
// A chave abaixo está como fallback porque o projeto já foi configurado para você.
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';
const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));


// Appwrite backend integration (V28B)
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '';
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'louvor_avida';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || '';
const APPWRITE_APP_STATE_COLLECTION_ID = process.env.APPWRITE_APP_STATE_COLLECTION_ID || 'app_state';
const APPWRITE_USER_STATE_COLLECTION_ID = process.env.APPWRITE_USER_STATE_COLLECTION_ID || 'user_state';

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
  res.json({ endpoint: APPWRITE_ENDPOINT, projectId: APPWRITE_PROJECT_ID, databaseId: APPWRITE_DATABASE_ID, ready: appwriteReady() });
});
app.get('/api/appwrite/state/:key', async (req, res) => {
  try {
    const docs = await listDocuments(APPWRITE_APP_STATE_COLLECTION_ID);
    const doc = docs.find(d => d.key === req.params.key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updatedAt || null });
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
      updatedAt,
      updatedBy: String(req.body.updatedBy || 'Sistema')
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
    const doc = docs.find(d => d.userId === req.params.userId && d.key === req.params.key);
    res.json({ value: doc?.value ? JSON.parse(doc.value) : null, updatedAt: doc?.updatedAt || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/appwrite/user-state/:userId/:key', async (req, res) => {
  try {
    const updatedAt = new Date().toISOString();
    const doc = await upsertState(APPWRITE_USER_STATE_COLLECTION_ID, d => d.userId === req.params.userId && d.key === req.params.key, {
      userId: req.params.userId,
      key: req.params.key,
      value: JSON.stringify(req.body.value ?? null),
      updatedAt,
      userName: String(req.body.userName || 'Usuário')
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
