import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const origin = 'https://mazameras.digitallpay.store';
const destination = resolve(process.argv[2] || 'backups/origem');
const rl = createInterface({ input: stdin, output: stdout });
const username = (await rl.question('Utilizador administrador do site atual: ')).trim();
rl.close();
if (!stdin.isTTY || !stdin.setRawMode) throw Error('Executa num terminal interativo para introduzir a senha em segurança.');
stdout.write('Senha do administrador do site atual (não aparece): ');
const password = await new Promise((resolvePassword, reject) => {
  let value = '';
  stdin.setRawMode(true); stdin.resume();
  function done(error) {
    stdin.removeListener('data', onData); stdin.setRawMode(false); stdin.pause(); stdout.write('\n');
    if (error) reject(error); else resolvePassword(value);
  }
  function onData(buffer) {
    for (const char of buffer.toString('utf8')) {
      if (char === '\u0003') { done(Error('Cancelado.')); return; }
      if (char === '\r' || char === '\n') { done(); return; }
      if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (char >= ' ') value += char;
    }
  }
  stdin.on('data', onData);
});

let cookie = '';
async function request(path, options = {}) {
  const result = await fetch(origin + path, { ...options, redirect: 'error', headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) }, signal: AbortSignal.timeout(120000) });
  if (!result.ok) throw Error(`O site recusou ${path.split('?')[0]} (HTTP ${result.status}). Confirma as credenciais e se a exportação está publicada.`);
  return result;
}
try {
  const login = await request('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username, password }) });
  cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  if (!cookie) throw Error('O site não criou uma sessão.');
  const snapshot = await (await request('/api/admin/migration')).json();
  if (snapshot.format !== 'medicina-vps-v1') throw Error('Formato de exportação inesperado.');
  if (snapshot.readOnly !== true) throw Error('A origem ainda aceita alterações. Ativa primeiro MIGRATION_READ_ONLY=1 no Sites para obter uma exportação final consistente.');
  // Refuse an existing directory: never mix two snapshots or overwrite a backup.
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await mkdir(destination, { mode: 0o700 });
  const assets = [...snapshot.tables.photos, ...snapshot.tables.avatars];
  const checksums = {};
  for (const asset of assets) {
    const key = asset.object_key;
    if (!/^(photos|avatars)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key)) throw Error('Caminho de imagem inválido.');
    const file = resolve(destination, 'uploads', key);
    const bytes = new Uint8Array(await (await request('/api/admin/migration?object='+encodeURIComponent(key))).arrayBuffer());
    if (!bytes.length) throw Error('Imagem vazia: '+key);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    checksums[key] = createHash('sha256').update(bytes).digest('hex');
  }
  snapshot.assetSha256 = checksums;
  await writeFile(resolve(destination, 'database.json.tmp'), JSON.stringify(snapshot), { mode: 0o600, flag: 'wx' });
  await rename(resolve(destination, 'database.json.tmp'), resolve(destination, 'database.json'));
  for (const [table, rows] of Object.entries(snapshot.tables)) console.log(table, rows.length);
  console.log(`Exportação completa: ${assets.length} imagens. Guardada em ${destination}. Não publiques esta pasta.`);
} finally {
  if (cookie) await request('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
}
