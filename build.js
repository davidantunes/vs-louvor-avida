// build.js — V127.3
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function sizeKB(filePath) {
  try { return (fs.statSync(filePath).size / 1024).toFixed(1) + ' KB'; } catch { return '?'; }
}

function minify(src, type) {
  const before = sizeKB(src);
  const tmp = src + '.min.tmp';
  try {
    const flag = type === 'css' ? '' : '--charset=utf8';
    execSync(
      `npx esbuild ${src} --bundle=false --minify ${flag} --allow-overwrite --outfile=${tmp}`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    fs.copyFileSync(src, src + '.source');  // backup
    fs.renameSync(tmp, src);                // substitui o original
    const after = sizeKB(src);
    const pct = Math.round((1 - fs.statSync(src).size / fs.statSync(src + '.source').size) * 100);
    console.log(`  ✓ ${path.basename(src)}: ${before} → ${after} (-${pct}%)`);
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.warn(`  ⚠ minificação falhou para ${path.basename(src)}, usando original`);
  }
}

console.log('\n=== Build VS Louvor Ávida ===');
minify(path.join(ROOT, 'app.js'), 'js');
minify(path.join(ROOT, 'styles.css'), 'css');
console.log('\n✓ Build concluído.\n');
