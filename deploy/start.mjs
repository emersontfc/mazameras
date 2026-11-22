import { openDatabase } from '../server/database.mjs';
const username = process.env.ADMIN_USERNAME || '';
const password = process.env.ADMIN_PASSWORD || '';
if (!/^[a-z0-9._-]{3,30}$/.test(username) || username.startsWith('replace_') || password.length < 16 || password.startsWith('replace_')) {
  throw Error('Set ADMIN_USERNAME and a strong ADMIN_PASSWORD (at least 16 characters) in .env.vps before starting.');
}
const { sqlite } = openDatabase();
const admins = sqlite.prepare("SELECT username FROM accounts WHERE role='admin'").all();
if (admins.length && !admins.some(a => a.username === username)) throw Error('ADMIN_USERNAME must match an existing imported administrator.');
sqlite.close();
await import('../server.js');
