import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export function openDatabase(dataDirectory = process.env.DATA_DIR || './data', migrations = resolve('drizzle')) {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const sqlite = new DatabaseSync(join(dataDirectory, 'book.sqlite'));
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _vps_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
  for (const name of readdirSync(migrations).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
    const sql = readFileSync(join(migrations, name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const previous = sqlite.prepare('SELECT sha256 FROM _vps_migrations WHERE name=?').get(name);
    if (previous) {
      if (previous.sha256 !== hash) throw Error(`Applied migration changed: ${name}`);
      continue;
    }
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _vps_migrations VALUES (?,?)').run(name, hash);
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  // Retain the async D1 statement contract used by the existing Drizzle queries.
  // Execution is local SQLite; no Cloudflare service or credentials are used.
  function prepare(sql, params = []) {
    const statement = () => sqlite.prepare(sql);
    return {
      bind(...values) { return prepare(sql, values); },
      async all() { return result(statement().all(...params)); },
      async raw() { const query = statement(); query.setReturnArrays(true); return query.all(...params); },
      async first(column) { const row = statement().get(...params); return column ? row?.[column] ?? null : row ?? null; },
      async run() { const info = statement().run(...params); return result([], info); },
      executeBatch() { const query = statement(); return query.columns().length ? result(query.all(...params)) : result([], query.run(...params)); },
    };
  }
  function result(results, info = {}) {
    return { success: true, results, meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0), duration: 0 } };
  }
  const client = {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const results = statements.map(s => s.executeBatch()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, client };
}
