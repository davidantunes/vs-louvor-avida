#!/usr/bin/env node
/**
 * migrar-para-appwrite.js — VS Louvor Ávida
 * ----------------------------------------------------------------------------
 * Migra os áudios do Google Drive para o Appwrite Storage (NÃO-DESTRUTIVO:
 * apenas LÊ do Drive, os arquivos originais permanecem intactos).
 *
 * O que faz:
 *   1. Lista todas as músicas do Google Drive (recursivo, a partir do ROOT)
 *   2. Para cada música: baixa do Drive e envia ao bucket do Appwrite
 *   3. Gera o arquivo "mapa-migracao.json" com { driveId: appwriteFileId }
 *   4. Pode ser re-executado: pula o que já foi migrado (idempotente)
 *
 * COMO USAR:
 *   1. Crie um bucket no Appwrite Console (Storage → Create Bucket).
 *      Anote o Bucket ID. Permissões de leitura: "Any" (para o app tocar).
 *   2. Crie uma API Key no Appwrite (Overview → Integrations → API Keys)
 *      com escopos: files.read, files.write
 *   3. Defina as variáveis de ambiente e rode:
 *
 *      export GOOGLE_DRIVE_API_KEY="sua-chave-do-drive"
 *      export ROOT_FOLDER_ID="1Tcua5y0O9Bv5LRNmtIYnDCderiaN8xB8"
 *      export APPWRITE_ENDPOINT="https://nyc.cloud.appwrite.io/v1"
 *      export APPWRITE_PROJECT_ID="69f4cb460024e484358b"
 *      export APPWRITE_API_KEY="sua-api-key-do-appwrite"
 *      export APPWRITE_BUCKET_ID="seu-bucket-id"
 *
 *      node migrar-para-appwrite.js
 *
 * Requer Node 18+ (usa fetch e FormData nativos).
 * ----------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

// ---- Configuração via variáveis de ambiente ----
const DRIVE_KEY   = process.env.GOOGLE_DRIVE_API_KEY || '';
const ROOT_FOLDER = process.env.ROOT_FOLDER_ID || '1Tcua5y0O9Bv5LRNmtIYnDCderiaN8xB8';
const AW_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const AW_PROJECT  = process.env.APPWRITE_PROJECT_ID || '';
const AW_KEY      = process.env.APPWRITE_API_KEY || '';
const AW_BUCKET   = process.env.APPWRITE_BUCKET_ID || '';

const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';
const MAPA_PATH = path.join(__dirname, 'mapa-migracao.json');

// ---- Validação inicial ----
function checarConfig() {
  const faltando = [];
  if (!DRIVE_KEY)   faltando.push('GOOGLE_DRIVE_API_KEY');
  if (!AW_PROJECT)  faltando.push('APPWRITE_PROJECT_ID');
  if (!AW_KEY)      faltando.push('APPWRITE_API_KEY');
  if (!AW_BUCKET)   faltando.push('APPWRITE_BUCKET_ID');
  if (faltando.length) {
    console.error('\n❌ Variáveis de ambiente faltando:\n   ' + faltando.join('\n   '));
    console.error('\nVeja as instruções no topo deste arquivo.\n');
    process.exit(1);
  }
}

// ---- Headers do Appwrite ----
function awHeaders(extra = {}) {
  return {
    'X-Appwrite-Project': AW_PROJECT,
    'X-Appwrite-Key': AW_KEY,
    ...extra
  };
}

// ---- Lista arquivos do Drive recursivamente ----
async function listarPastaDrive(folderId, acumulado = []) {
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      key: DRIVE_KEY,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: '1000'
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${GOOGLE_API}?${params}`);
    if (!res.ok) {
      throw new Error(`Drive listagem falhou (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const files = data.files || [];

    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        await listarPastaDrive(f.id, acumulado); // recursivo
      } else if (/\.(mp3|m4a|ogg|opus|wav|aac)$/i.test(f.name) || f.mimeType?.startsWith('audio/')) {
        acumulado.push({ id: f.id, name: f.name });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return acumulado;
}

// ---- Baixa um arquivo do Drive ----
async function baixarDoDrive(fileId) {
  const url = `${GOOGLE_API}/${encodeURIComponent(fileId)}?alt=media&key=${DRIVE_KEY}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download falhou (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

// ---- Envia um arquivo ao Appwrite Storage ----
async function enviarParaAppwrite(buffer, fileName) {
  const form = new FormData();
  // Appwrite gera o ID se passarmos 'unique()'
  form.append('fileId', 'unique()');
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  form.append('file', blob, fileName);

  const res = await fetch(`${AW_ENDPOINT}/storage/buckets/${AW_BUCKET}/files`, {
    method: 'POST',
    headers: awHeaders(), // não setar Content-Type: o FormData define o boundary
    body: form
  });

  if (!res.ok) {
    throw new Error(`upload Appwrite falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.$id; // ID do arquivo no Appwrite
}

// ---- Carrega/salva o mapa (idempotência) ----
function carregarMapa() {
  try { return JSON.parse(fs.readFileSync(MAPA_PATH, 'utf8')); } catch { return {}; }
}
function salvarMapa(mapa) {
  fs.writeFileSync(MAPA_PATH, JSON.stringify(mapa, null, 2));
}

// ---- Programa principal ----
async function main() {
  checarConfig();
  console.log('\n=== Migração Google Drive → Appwrite Storage ===');
  console.log(`Bucket destino: ${AW_BUCKET}`);
  console.log(`Pasta raiz Drive: ${ROOT_FOLDER}\n`);

  console.log('📂 Listando músicas no Drive (pode demorar)...');
  const musicas = await listarPastaDrive(ROOT_FOLDER);
  console.log(`   Encontradas: ${musicas.length} músicas\n`);

  const mapa = carregarMapa();
  const jaMigradas = Object.keys(mapa).length;
  if (jaMigradas) console.log(`↻ Retomando: ${jaMigradas} já migradas anteriormente (serão puladas)\n`);

  let ok = 0, pulou = 0, falhou = 0;
  const erros = [];

  for (let i = 0; i < musicas.length; i++) {
    const m = musicas[i];
    const progresso = `[${i + 1}/${musicas.length}]`;

    if (mapa[m.id]) { pulou++; continue; }

    process.stdout.write(`${progresso} ${m.name.slice(0, 45).padEnd(45)} `);

    // Retry até 3x
    let sucesso = false;
    for (let tentativa = 1; tentativa <= 3 && !sucesso; tentativa++) {
      try {
        const buffer = await baixarDoDrive(m.id);
        const appwriteId = await enviarParaAppwrite(buffer, m.name);
        mapa[m.id] = appwriteId;
        salvarMapa(mapa); // salva a cada arquivo (à prova de interrupção)
        console.log(`✓ ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
        ok++;
        sucesso = true;
      } catch (e) {
        if (tentativa < 3) {
          await new Promise(r => setTimeout(r, 1000 * tentativa));
        } else {
          console.log(`✗ ${e.message.slice(0, 50)}`);
          erros.push({ name: m.name, id: m.id, erro: e.message });
          falhou++;
        }
      }
    }
  }

  console.log('\n=== Resumo ===');
  console.log(`✓ Migradas:  ${ok}`);
  console.log(`↻ Puladas:   ${pulou} (já existiam)`);
  console.log(`✗ Falharam:  ${falhou}`);
  console.log(`\n📄 Mapa salvo em: ${MAPA_PATH}`);

  if (erros.length) {
    console.log('\n⚠ Músicas que falharam (rode o script de novo para tentar):');
    erros.forEach(e => console.log(`   - ${e.name}: ${e.erro.slice(0, 60)}`));
  }

  console.log('\nPróximo passo: me envie o arquivo mapa-migracao.json para');
  console.log('eu vincular as músicas ao Appwrite no app.\n');
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
