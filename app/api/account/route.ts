import { getDb } from '../../../db';
import { accounts, loginAttempts } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { currentAccount, adminPassword, adminUsername, normalizeUsername, passwordHash, randomHex, equalHex, issueSession, endSession } from '../../../lib/account-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await currentAccount();
  return Response.json({ account });
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const action = String(input.action || '');
  if (action === 'logout') { await endSession(); return Response.json({ ok: true }); }
  const username = normalizeUsername(String(input.username || ''));
  const password = String(input.password || '');
  const displayName = String(input.displayName || '').trim().slice(0, 100);
  if (!/^[a-z0-9._-]{3,30}$/.test(username) || !password || password.length > 128) return Response.json({ error: 'Utilizador ou palavra-passe inválidos.' }, { status: 400 });
  const db = getDb();
  if (action === 'register') {
    if (username === adminUsername()) return Response.json({ error: 'Este nome de utilizador está reservado.' }, { status: 409 });
    if (password.length < 8 || !displayName || displayName.length < 3) return Response.json({ error: 'Indica o nome completo e uma palavra-passe com pelo menos 8 caracteres.' }, { status: 400 });
    const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, username)).limit(1);
    if (existing.length) return Response.json({ error: 'Este nome de utilizador já está em uso.' }, { status: 409 });
    const id = crypto.randomUUID(); const salt = randomHex();
    try { await db.insert(accounts).values({ id, username, displayName, salt, passwordHash: await passwordHash(password, salt), role: 'author', createdAt: Date.now() }); }
    catch { return Response.json({ error: 'Não foi possível criar a conta. Tenta outro nome de utilizador.' }, { status: 409 }); }
    await issueSession(id); return Response.json({ account: { id, username, displayName, role: 'author' } });
  }
  if (action !== 'login') return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  const now = Date.now();
  const attempt = (await db.select().from(loginAttempts).where(eq(loginAttempts.username, username)).limit(1))[0];
  if (attempt && attempt.count >= 5 && now - attempt.lastAttempt < 15 * 60 * 1000) return Response.json({ error: 'Muitas tentativas. Espera 15 minutos antes de tentar novamente.' }, { status: 429 });
  let found = (await db.select().from(accounts).where(eq(accounts.username, username)).limit(1))[0];
  let valid = false;
  if (username === adminUsername() && adminPassword()) {
    valid = equalHex(await passwordHash(password, 'mazameras-admin-credential'), await passwordHash(adminPassword(), 'mazameras-admin-credential'));
    if (valid && !found) {
      const id = crypto.randomUUID(); const salt = randomHex();
      await db.insert(accounts).values({ id, username, displayName: 'Emerson Charles', salt, passwordHash: await passwordHash(password, salt), role: 'admin', createdAt: now });
      found = (await db.select().from(accounts).where(eq(accounts.username, username)).limit(1))[0];
    }
  } else if (found && found.role !== 'admin') valid = equalHex(await passwordHash(password, found.salt), found.passwordHash);
  if (!valid || !found) {
    await db.insert(loginAttempts).values({ username, count: attempt && now - attempt.lastAttempt < 15 * 60 * 1000 ? attempt.count + 1 : 1, lastAttempt: now }).onConflictDoUpdate({ target: loginAttempts.username, set: { count: attempt && now - attempt.lastAttempt < 15 * 60 * 1000 ? attempt.count + 1 : 1, lastAttempt: now } });
    return Response.json({ error: 'Utilizador ou palavra-passe incorretos.' }, { status: 401 });
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  await issueSession(found.id);
  return Response.json({ account: { id: found.id, username: found.username, displayName: found.displayName, role: found.role } });
}
