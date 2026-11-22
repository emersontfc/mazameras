import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export function localBucket(root = resolve(process.env.DATA_DIR || './data', 'uploads')) {
  root = resolve(root);
  function filename(key) {
    if (!key || key.includes('\\') || key.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid object key');
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw Error('Invalid object key');
    return path;
  }
  return {
    async get(key) {
      try { return { body: new Uint8Array(await readFile(filename(key))) }; }
      catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async put(key, value, _options) {
      const path = filename(key); await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temp = `${path}.${randomUUID()}.tmp`;
      try { await writeFile(temp, value, { mode: 0o600 }); await rename(temp, path); }
      catch (e) { await unlink(temp).catch(() => {}); throw e; }
    },
    async delete(key) { await unlink(filename(key)).catch(e => { if (e.code !== 'ENOENT') throw e; }); },
  };
}
