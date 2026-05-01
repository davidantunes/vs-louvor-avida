const express = require('express');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || 'SUA_CHAVE_GOOGLE_DRIVE_API';
const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';

app.use(express.static(__dirname));

function googleMediaUrl(id) {
  return `${GOOGLE_API}/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(API_KEY)}`;
}

app.get('/api/drive', async (req, res) => {
  try {
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
    const id = req.params.id;
    const headers = {};

    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const response = await fetch(googleMediaUrl(id), { headers });

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).send(await response.text());
    }

    res.status(response.status);

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);

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
  const id = req.params.id;
  const semitones = Math.max(-12, Math.min(12, Number(req.query.semitones || 0)));
  const factor = Math.pow(2, semitones / 12);
  const tempo = 1 / factor;

  try {
    const response = await fetch(googleMediaUrl(id));

    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }

    res.setHeader('Content-Type', 'audio/mpeg');

    if (req.query.download) {
      const filename = req.query.filename || `audio_tom_${semitones}.mp3`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

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

    proc.stderr.on('data', data => {
      console.error(String(data));
    });

    proc.on('close', code => {
      if (code !== 0) {
        console.error(`FFmpeg finalizou com código ${code}`);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao transpor áudio.');
  }
});

app.listen(PORT, () => {
  console.log(`Biblioteca de Louvor rodando na porta ${PORT}`);
});
